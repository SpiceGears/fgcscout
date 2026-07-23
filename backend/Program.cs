using backend.Models;
using backend.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<DatabaseSettings>(
    builder.Configuration.GetSection("DatabaseSettings"));

builder.Services.AddSingleton<DBService>();

builder.Services.AddControllers();

// Allow CORS for local frontend during development
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCors", pb => pb.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// In development we may run frontend on a different origin or without a trusted dev cert.
// Avoid forcing HTTPS redirects during development to prevent TLS/network errors in the browser.
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("DevCors");

app.MapControllers();

app.Run();