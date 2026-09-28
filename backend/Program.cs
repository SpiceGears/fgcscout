using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.ResponseCompression;
using System.IO.Compression;
using System.Threading.RateLimiting;
using System.Security.Cryptography;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 26 * 1024 * 1024;
});

builder.Services.Configure<DatabaseSettings>(
    builder.Configuration.GetSection("DatabaseSettings"));

builder.Services.AddSingleton<DBService>();
builder.Services.AddSingleton<SeasonImportService>();
builder.Services.AddHttpClient<SeasonSyncService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("FGCScout/1.0 (+https://results.first.global)");
});
builder.Services.AddHostedService<SeasonSyncWorker>();
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("mongodb");
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    // The production backend is reachable only on the private Compose network.
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["application/json"]);
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        var protectedRequest = RequiresAdminKey(context.Request);
        var client = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(
            $"{client}:{(protectedRequest ? "admin" : "public")}",
            _ => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = protectedRequest ? 30 : 300,
                QueueLimit = 0,
                Window = TimeSpan.FromMinutes(1)
            });
    });
});

builder.Services.AddControllers();

// Allow CORS for local frontend during development
builder.Services.AddCors(options =>
{
    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? ["http://localhost:3000"];
    options.AddPolicy("Frontend", policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod());
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

var configuredAdminKey = builder.Configuration["AdminSettings:ApiKey"];
if (app.Environment.IsProduction() && (configuredAdminKey?.Length ?? 0) < 32)
{
    throw new InvalidOperationException(
        "AdminSettings:ApiKey must contain at least 32 characters in production.");
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (app.Environment.IsProduction())
{
    app.UseForwardedHeaders();
}

// Containers serve HTTP internally. Enable this only when ASP.NET itself terminates TLS;
// deployments behind a reverse proxy should leave it disabled and terminate TLS there.
if (builder.Configuration.GetValue<bool>("HttpsRedirection:Enabled"))
{
    app.UseHttpsRedirection();
}

app.UseResponseCompression();
app.UseCors("Frontend");
app.UseRateLimiter();

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";

    if (HttpMethods.IsGet(context.Request.Method) &&
        (context.Request.Path.StartsWithSegments("/api/GameData", StringComparison.OrdinalIgnoreCase) ||
         context.Request.Path.StartsWithSegments("/api/Teams", StringComparison.OrdinalIgnoreCase) ||
         context.Request.Path.StartsWithSegments("/api/Seasons", StringComparison.OrdinalIgnoreCase)))
    {
        context.Response.Headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=120";
    }

    await next();
});

app.Use(async (context, next) =>
{
    if (!RequiresAdminKey(context.Request))
    {
        await next();
        return;
    }

    var expectedKey = builder.Configuration["AdminSettings:ApiKey"];
    if (string.IsNullOrWhiteSpace(expectedKey))
    {
        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        await context.Response.WriteAsJsonAsync(new { error = "Admin API is disabled. Configure AdminSettings:ApiKey." });
        return;
    }

    var providedKey = context.Request.Headers["X-Admin-Key"].ToString();
    if (string.IsNullOrWhiteSpace(providedKey) || !SecureEquals(expectedKey, providedKey))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { error = "Invalid admin key." });
        return;
    }

    await next();
});

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();

static bool SecureEquals(string expected, string provided)
{
    var expectedHash = SHA256.HashData(Encoding.UTF8.GetBytes(expected));
    var providedHash = SHA256.HashData(Encoding.UTF8.GetBytes(provided));
    return CryptographicOperations.FixedTimeEquals(expectedHash, providedHash);
}

static bool RequiresAdminKey(HttpRequest request)
{
    if (request.Path.StartsWithSegments("/api/Admin", StringComparison.OrdinalIgnoreCase)) return true;
    if (!request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase)) return false;
    return !HttpMethods.IsGet(request.Method) &&
           !HttpMethods.IsHead(request.Method) &&
           !HttpMethods.IsOptions(request.Method);
}
