using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly DBService _db;
    private readonly SeasonImportService _seasonImportService;
    private readonly SeasonSyncService _seasonSyncService;

    public AdminController(DBService db, SeasonImportService seasonImportService, SeasonSyncService seasonSyncService)
    {
        _db = db;
        _seasonImportService = seasonImportService;
        _seasonSyncService = seasonSyncService;
    }

    [HttpGet("seasons")]
    public async Task<IActionResult> GetSeasons()
    {
        var configurations = (await _db.GetSeasonConfigurationsAsync()).ToDictionary(item => item.Year);
        var years = (await _db.GetGameDataYearsAsync())
            .Concat(configurations.Keys)
            .Distinct()
            .OrderByDescending(year => year);
        var seasons = new List<object>();
        foreach (var year in years)
        {
            configurations.TryGetValue(year, out var configuration);
            seasons.Add(new
            {
                year,
                name = configuration?.Name ?? $"FIRST Global Challenge {year}",
                matchCount = await _db.CountGameDataAsync(year),
                sourceUrl = configuration?.SourceUrl ?? "https://api.first.global/v1",
                syncEnabled = configuration?.SyncEnabled ?? false,
                syncIntervalMinutes = configuration?.SyncIntervalMinutes ?? 5,
                lastSyncAt = configuration?.LastSyncAt,
                lastSyncError = configuration?.LastSyncError,
                lastSyncMatchCount = configuration?.LastSyncMatchCount
            });
        }

        return Ok(seasons);
    }

    [HttpDelete("seasons/{year:int}")]
    public async Task<IActionResult> DeleteSeason(uint year)
    {
        var deletedMatches = await _db.RemoveGameDataSeasonAsync(year);
        var configuration = await _db.GetSeasonConfigurationAsync(year);
        if (deletedMatches == 0 && configuration is null)
            return NotFound(new { error = $"Season {year} was not found." });

        await _db.RemoveSeasonConfigurationAsync(year);
        await _db.RemoveLiveVideoConfigurationAsync(year);

        return Ok(new { year, deletedMatches });
    }

    [HttpGet("seasons/{year:int}/export")]
    public async Task<IActionResult> ExportSeason(uint year)
    {
        var matches = await _db.GetGameDataAsync(year);
        if (matches.Count == 0)
            return NotFound(new { error = $"Season {year} does not contain any matches." });

        var payload = new
        {
            matches = matches.Select(match => ConvertBsonToClr(match.Data)).ToList()
        };
        var json = System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(
            payload,
            new System.Text.Json.JsonSerializerOptions { WriteIndented = true });

        return File(json, "application/json; charset=utf-8", $"fgcscout-season-{year}.json");
    }

    public sealed record SeasonConfigurationRequest(
        string? Name,
        string? SourceUrl,
        bool SyncEnabled,
        int SyncIntervalMinutes);

    [HttpPut("seasons/{year:int}")]
    public async Task<IActionResult> ConfigureSeason(uint year, [FromBody] SeasonConfigurationRequest request)
    {
        if (year < 2017 || year > 2100) return BadRequest(new { error = "Enter a valid FIRST Global season year." });
        if ((request.Name?.Length ?? 0) > 120) return BadRequest(new { error = "Season name cannot exceed 120 characters." });
        var sourceUrl = string.IsNullOrWhiteSpace(request.SourceUrl) ? "https://api.first.global/v1" : request.SourceUrl.Trim();
        if (sourceUrl.Length > 2048 || !Uri.TryCreate(sourceUrl, UriKind.Absolute, out var uri))
            return BadRequest(new { error = "The sync source must be an absolute HTTPS URL." });
        try
        {
            _seasonSyncService.ValidateSourceUri(uri);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { error = exception.Message });
        }

        var existing = await _db.GetSeasonConfigurationAsync(year);
        var configuration = new SeasonConfiguration
        {
            Year = year,
            Name = string.IsNullOrWhiteSpace(request.Name) ? $"FIRST Global Challenge {year}" : request.Name.Trim(),
            SourceUrl = sourceUrl,
            SyncEnabled = request.SyncEnabled,
            SyncIntervalMinutes = Math.Clamp(request.SyncIntervalMinutes, 1, 1440),
            LastSyncAt = existing?.LastSyncAt,
            LastSyncError = existing?.LastSyncError,
            LastSyncMatchCount = existing?.LastSyncMatchCount
        };
        await _db.UpsertSeasonConfigurationAsync(configuration);
        return Ok(configuration);
    }

    [HttpPost("seasons/{year:int}/sync")]
    public async Task<IActionResult> SyncSeason(uint year, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _seasonSyncService.SyncAsync(year, cancellationToken);
            return Ok(new
            {
                year = result.Year,
                matches = result.MatchCount,
                insertedMatches = result.InsertedMatches,
                updatedMatches = result.UpdatedMatches,
                upsertedTeams = result.UpsertedTeams
            });
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { error = exception.Message });
        }
        catch (HttpRequestException exception)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { error = $"The upstream results source failed: {exception.Message}" });
        }
    }

    public sealed record MatchVideoRequest(string? VideoUrl, double? StartTimestamp = null,
        double? EndTimestamp = null, string? Status = null, string? DetectionId = null,
        bool OnlyIfEmpty = false);

    [HttpGet("video-capabilities")]
    public IActionResult VideoCapabilities() => Ok(new { liveVideoVersion = 2 });

    [HttpPut("matches/{id}/video")]
    public async Task<IActionResult> SetMatchVideo(string id, [FromBody] MatchVideoRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.VideoUrl) &&
            (request.StartTimestamp.HasValue || request.EndTimestamp.HasValue || request.Status is not null))
            return BadRequest(new { error = "Video metadata requires a video URL." });
        if (request.Status is not null && !request.StartTimestamp.HasValue)
            return BadRequest(new { error = "Video status requires a start timestamp." });
        if (request.StartTimestamp is double start && (!double.IsFinite(start) || start < 0) ||
            request.EndTimestamp is double end && (!double.IsFinite(end) || end < 0) ||
            request.EndTimestamp.HasValue && (!request.StartTimestamp.HasValue || request.EndTimestamp <= request.StartTimestamp))
            return BadRequest(new { error = "Invalid video timestamps." });
        if (request.Status is not null && request.Status is not ("live" or "complete" or "interrupted"))
            return BadRequest(new { error = "Invalid video status." });
        if (request.Status == "complete" && !request.EndTimestamp.HasValue)
            return BadRequest(new { error = "A complete recording needs an end timestamp." });
        if ((request.DetectionId?.Length ?? 0) > 120 || request.OnlyIfEmpty && string.IsNullOrWhiteSpace(request.DetectionId))
            return BadRequest(new { error = "A bounded detection ID is required for automatic updates." });
        if (!string.IsNullOrWhiteSpace(request.VideoUrl))
        {
            if (!Uri.TryCreate(request.VideoUrl, UriKind.Absolute, out var uri) ||
                uri.Scheme != Uri.UriSchemeHttps ||
                !(uri.Host.Equals("youtube.com", StringComparison.OrdinalIgnoreCase) ||
                  uri.Host.EndsWith(".youtube.com", StringComparison.OrdinalIgnoreCase) ||
                  uri.Host.Equals("youtu.be", StringComparison.OrdinalIgnoreCase) ||
                  uri.Host.EndsWith(".youtu.be", StringComparison.OrdinalIgnoreCase)))
            {
                return BadRequest(new { error = "Enter a valid youtube.com or youtu.be URL." });
            }
        }

        var updated = await _db.UpdateMatchVideoAsync(id, request.VideoUrl, request.StartTimestamp,
            request.EndTimestamp, request.Status, request.DetectionId, request.OnlyIfEmpty);
        if (!updated)
        {
            if (await _db.GetGameDataAsync(id) is null) return NotFound(new { error = "Match not found." });
            return Conflict(new { error = "This match already has another recording." });
        }
        return Ok(new { id, videoUrl = request.VideoUrl, startTimestamp = request.StartTimestamp,
            endTimestamp = request.EndTimestamp, status = request.Status });
    }

    // POST api/admin/importMatches
    // Accepts either { "matches": [ ... ] } or an array of match objects
    [HttpPost("importMatches")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<IActionResult> ImportMatches([FromBody] System.Text.Json.JsonElement payload)
    {
        var matchesEl = payload;
        if (payload.ValueKind == System.Text.Json.JsonValueKind.Object && payload.TryGetProperty("matches", out var m))
            matchesEl = m;

        if (matchesEl.ValueKind != System.Text.Json.JsonValueKind.Array)
            return BadRequest(new { error = "Expected an array of matches or an object with 'matches' array." });

        var list = new List<GameData>();
        foreach (var item in matchesEl.EnumerateArray())
        {
            var doc = JsonElementToBsonDocument(item);

            // Try to parse year from eventKey like FGC_2024-...
            uint year = (uint)System.DateTime.UtcNow.Year;
            if (item.TryGetProperty("eventKey", out var ev) && ev.ValueKind == System.Text.Json.JsonValueKind.String)
            {
                var s = ev.GetString() ?? string.Empty;
                var mYear = System.Text.RegularExpressions.Regex.Match(s, "(\\d{4})");
                if (mYear.Success && uint.TryParse(mYear.Value, out var y)) year = y;
            }

            var gd = new GameData
            {
                Year = year,
                TeamId = null,
                Data = doc,
                CreatedAt = System.DateTime.UtcNow
            };

            list.Add(gd);
        }

        if (list.Count == 0) return BadRequest(new { error = "No matches found in payload." });

        await _db.CreateGameDataManyAsync(list);
        return Ok(new { matches = list.Count });
    }

    // POST api/admin/importTeams
    // Accepts either an array of team objects or { matches: [...] } (extracts participants)
    [HttpPost("importTeams")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<IActionResult> ImportTeams([FromBody] System.Text.Json.JsonElement payload)
    {
        var teams = new Dictionary<string, Team>();

        if (payload.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            // assume array of team-like objects
            foreach (var el in payload.EnumerateArray())
            {
                AddTeamFromElement(el, teams);
            }
        }
        else if (payload.ValueKind == System.Text.Json.JsonValueKind.Object && payload.TryGetProperty("matches", out var m) && m.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            foreach (var match in m.EnumerateArray())
            {
                if (match.TryGetProperty("participants", out var parts) && parts.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    foreach (var p in parts.EnumerateArray()) AddTeamFromElement(p, teams);
                }
            }
        }
        else
        {
            return BadRequest(new { error = "Unsupported payload. Send teams array or { matches: [...] }." });
        }

        var teamList = teams.Values.ToList();
        if (teamList.Count == 0) return BadRequest(new { error = "No teams found in payload." });

        await _db.UpsertTeamsAsync(teamList);
        return Ok(new { upserted = teamList.Count });
    }

    // POST api/admin/importSeason
    // Imports a full season file: matches -> GameData, participants -> Teams
    [HttpPost("importSeason")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<IActionResult> ImportSeason(
        [FromBody] System.Text.Json.JsonElement payload,
        [FromQuery] bool replaceExisting = true)
    {
        try
        {
            var result = await _seasonImportService.ImportAsync(payload, replaceExisting);
            return Ok(new
            {
                year = result.Year,
                playedMatches = result.MatchCount,
                upsertedTeams = result.UpsertedTeams,
                replacedMatches = result.ReplacedMatches,
                insertedMatches = result.InsertedMatches,
                updatedMatches = result.UpdatedMatches
            });
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { error = exception.Message });
        }
    }

    private static uint? TryGetYear(System.Text.Json.JsonElement item)
    {
        if (!item.TryGetProperty("eventKey", out var eventKey) ||
            eventKey.ValueKind != System.Text.Json.JsonValueKind.String)
            return null;

        var match = System.Text.RegularExpressions.Regex.Match(
            eventKey.GetString() ?? string.Empty,
            "(\\d{4})");
        return match.Success && uint.TryParse(match.Value, out var year) ? year : null;
    }

    private void AddTeamFromElement(System.Text.Json.JsonElement el, Dictionary<string, Team> dst)
    {
        // look for teamKey or id
        string id = "";
        if (el.TryGetProperty("teamKey", out var tk) && tk.ValueKind == System.Text.Json.JsonValueKind.Number)
            id = tk.GetInt32().ToString();
        else if (el.TryGetProperty("id", out var idEl) && idEl.ValueKind == System.Text.Json.JsonValueKind.Number)
            id = idEl.GetInt32().ToString();
        else if (el.TryGetProperty("id", out var idStr) && idStr.ValueKind == System.Text.Json.JsonValueKind.String)
            id = idStr.GetString() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(id)) return;

        if (dst.ContainsKey(id)) return;

        var team = new Team { Id = id };
        if (el.TryGetProperty("country", out var c) && c.ValueKind == System.Text.Json.JsonValueKind.String)
            team.Country = c.GetString() ?? "";
        if (el.TryGetProperty("countryCode", out var cc) && cc.ValueKind == System.Text.Json.JsonValueKind.String)
            team.CountryCode = cc.GetString() ?? "";
        if (el.TryGetProperty("disqualified", out var dq) && (dq.ValueKind == System.Text.Json.JsonValueKind.Number || dq.ValueKind == System.Text.Json.JsonValueKind.True || dq.ValueKind == System.Text.Json.JsonValueKind.False))
            team.Disqualified = dq.ValueKind == System.Text.Json.JsonValueKind.True || (dq.ValueKind == System.Text.Json.JsonValueKind.Number && dq.GetInt32() != 0);

        dst[id] = team;
    }

    private MongoDB.Bson.BsonDocument JsonElementToBsonDocument(System.Text.Json.JsonElement el)
    {
        var doc = new BsonDocument();
        if (el.ValueKind != System.Text.Json.JsonValueKind.Object) return doc;

        foreach (var prop in el.EnumerateObject())
        {
            doc[prop.Name] = ConvertJsonElementToBsonValue(prop.Value);
        }

        return doc;
    }

    private static object? ConvertBsonToClr(BsonValue? value)
    {
        if (value is null || value.IsBsonNull) return null;

        return value.BsonType switch
        {
            BsonType.Document => value.AsBsonDocument.ToDictionary(
                element => element.Name,
                element => ConvertBsonToClr(element.Value)),
            BsonType.Array => value.AsBsonArray.Select(ConvertBsonToClr).ToList(),
            BsonType.String => value.AsString,
            BsonType.Int32 => value.AsInt32,
            BsonType.Int64 => value.AsInt64,
            BsonType.Double => value.AsDouble,
            BsonType.Decimal128 => value.AsDecimal128.ToString(),
            BsonType.Boolean => value.AsBoolean,
            BsonType.DateTime => value.ToUniversalTime(),
            BsonType.ObjectId => value.AsObjectId.ToString(),
            _ => value.ToString()
        };
    }

    private BsonValue ConvertJsonElementToBsonValue(System.Text.Json.JsonElement el)
    {
        switch (el.ValueKind)
        {
            case System.Text.Json.JsonValueKind.Object:
                return JsonElementToBsonDocument(el);
            case System.Text.Json.JsonValueKind.Array:
                var arr = new BsonArray();
                foreach (var item in el.EnumerateArray()) arr.Add(ConvertJsonElementToBsonValue(item));
                return arr;
            case System.Text.Json.JsonValueKind.String:
                return new BsonString(el.GetString() ?? string.Empty);
            case System.Text.Json.JsonValueKind.Number:
                if (el.TryGetInt64(out var l)) return new BsonInt64(l);
                if (el.TryGetDouble(out var d)) return new BsonDouble(d);
                return new BsonDouble(0);
            case System.Text.Json.JsonValueKind.True:
                return BsonBoolean.True;
            case System.Text.Json.JsonValueKind.False:
                return BsonBoolean.False;
            case System.Text.Json.JsonValueKind.Null:
            default:
                return BsonNull.Value;
        }
    }
}
