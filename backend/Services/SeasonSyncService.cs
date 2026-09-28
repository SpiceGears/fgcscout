using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using backend.Models;

namespace backend.Services;

public sealed class SeasonSyncService
{
    private readonly HttpClient _httpClient;
    private readonly DBService _db;
    private readonly SeasonImportService _importService;
    private readonly SemaphoreSlim _syncLock = new(1, 1);
    private readonly HashSet<string> _allowedHosts;

    public SeasonSyncService(HttpClient httpClient, DBService db, SeasonImportService importService, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _db = db;
        _importService = importService;
        _allowedHosts = new HashSet<string>(
            configuration.GetSection("SeasonSync:AllowedHosts").Get<string[]>() ?? ["results.first.global"],
            StringComparer.OrdinalIgnoreCase);
    }

    public async Task<SeasonImportService.ImportResult> SyncAsync(uint year, CancellationToken cancellationToken = default)
    {
        var configuration = await _db.GetSeasonConfigurationAsync(year)
            ?? throw new InvalidOperationException($"Season {year} is not configured.");

        if (!Uri.TryCreate(configuration.SourceUrl, UriKind.Absolute, out var sourceUri))
            throw new InvalidOperationException("The sync source must be an absolute HTTPS URL.");
        ValidateSourceUri(sourceUri);

        await _syncLock.WaitAsync(cancellationToken);
        try
        {
            using var response = await _httpClient.GetAsync(sourceUri, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            response.EnsureSuccessStatusCode();
            var length = response.Content.Headers.ContentLength;
            if (length > 25 * 1024 * 1024) throw new InvalidOperationException("The sync response is larger than 25 MB.");
            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            if (content.Length > 25 * 1024 * 1024) throw new InvalidOperationException("The sync response is larger than 25 MB.");

            using var document = ParseSource(content);
            var payload = ExtractPayload(document.RootElement).Clone();
            var result = await _importService.ImportAsync(payload, replaceExisting: false, expectedYear: year, cancellationToken);

            configuration.LastSyncAt = DateTime.UtcNow;
            configuration.LastSyncError = null;
            configuration.LastSyncMatchCount = result.MatchCount;
            await _db.UpsertSeasonConfigurationAsync(configuration);
            return result;
        }
        catch (Exception exception)
        {
            configuration.LastSyncAt = DateTime.UtcNow;
            configuration.LastSyncError = exception.Message.Length > 500 ? exception.Message[..500] : exception.Message;
            await _db.UpsertSeasonConfigurationAsync(configuration);
            throw;
        }
        finally
        {
            _syncLock.Release();
        }
    }

    public void ValidateSourceUri(Uri sourceUri)
    {
        if (sourceUri.Scheme != Uri.UriSchemeHttps || sourceUri.IsLoopback ||
            string.IsNullOrWhiteSpace(sourceUri.Host) || !_allowedHosts.Contains(sourceUri.IdnHost))
        {
            throw new InvalidOperationException(
                $"The sync source must use HTTPS and one of the allowed hosts: {string.Join(", ", _allowedHosts.Order())}.");
        }
    }

    private static JsonDocument ParseSource(string content)
    {
        if (!content.TrimStart().StartsWith('<')) return JsonDocument.Parse(content);

        var match = Regex.Match(
            content,
            "<script[^>]+id=[\\\"']__NEXT_DATA__[\\\"'][^>]*>(?<json>.*?)</script>",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        if (!match.Success) throw new InvalidOperationException("The results page does not contain __NEXT_DATA__.");
        return JsonDocument.Parse(WebUtility.HtmlDecode(match.Groups["json"].Value));
    }

    private static JsonElement ExtractPayload(JsonElement root)
    {
        if (root.ValueKind == JsonValueKind.Array || root.TryGetProperty("matches", out _)) return root;
        if (root.TryGetProperty("props", out var props) &&
            props.TryGetProperty("pageProps", out var pageProps) &&
            pageProps.TryGetProperty("data", out var data)) return data;
        return root;
    }
}
