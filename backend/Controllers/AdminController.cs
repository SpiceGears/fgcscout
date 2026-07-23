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

    public AdminController(DBService db)
    {
        _db = db;
    }

    [HttpGet("seasons")]
    public async Task<IActionResult> GetSeasons()
    {
        var years = (await _db.GetGameDataYearsAsync()).OrderByDescending(year => year);
        var seasons = new List<object>();
        foreach (var year in years)
        {
            seasons.Add(new
            {
                year,
                matchCount = await _db.CountGameDataAsync(year)
            });
        }

        return Ok(seasons);
    }

    [HttpDelete("seasons/{year:int}")]
    public async Task<IActionResult> DeleteSeason(uint year)
    {
        var deletedMatches = await _db.RemoveGameDataSeasonAsync(year);
        if (deletedMatches == 0)
            return NotFound(new { error = $"Season {year} was not found." });

        return Ok(new { year, deletedMatches });
    }

    public sealed record MatchVideoRequest(string? VideoUrl);

    [HttpPut("matches/{id}/video")]
    public async Task<IActionResult> SetMatchVideo(string id, [FromBody] MatchVideoRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.VideoUrl))
        {
            if (!Uri.TryCreate(request.VideoUrl, UriKind.Absolute, out var uri) ||
                !(uri.Host.Equals("youtube.com", StringComparison.OrdinalIgnoreCase) ||
                  uri.Host.EndsWith(".youtube.com", StringComparison.OrdinalIgnoreCase) ||
                  uri.Host.Equals("youtu.be", StringComparison.OrdinalIgnoreCase) ||
                  uri.Host.EndsWith(".youtu.be", StringComparison.OrdinalIgnoreCase)))
            {
                return BadRequest(new { error = "Enter a valid youtube.com or youtu.be URL." });
            }
        }

        var updated = await _db.UpdateMatchVideoAsync(id, request.VideoUrl);
        if (!updated) return NotFound(new { error = "Match not found." });
        return Ok(new { id, videoUrl = request.VideoUrl });
    }

    // POST api/admin/importMatches
    // Accepts either { "matches": [ ... ] } or an array of match objects
    [HttpPost("importMatches")]
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
    public async Task<IActionResult> ImportSeason(
        [FromBody] System.Text.Json.JsonElement payload,
        [FromQuery] bool replaceExisting = true)
    {
        System.Text.Json.JsonElement matchesEl = default;
        if (payload.ValueKind == System.Text.Json.JsonValueKind.Array)
            matchesEl = payload;
        else if (payload.ValueKind == System.Text.Json.JsonValueKind.Object && payload.TryGetProperty("matches", out var m))
            matchesEl = m;
        else
            return BadRequest(new { error = "Expected an array of matches or an object with 'matches'." });

        if (matchesEl.ValueKind != System.Text.Json.JsonValueKind.Array)
            return BadRequest(new { error = "The 'matches' property must be an array." });

        var matchElements = matchesEl.EnumerateArray().ToList();
        if (matchElements.Count == 0)
            return BadRequest(new { error = "The season file does not contain any matches." });

        var detectedYears = matchElements
            .Select(TryGetYear)
            .Where(year => year.HasValue)
            .Select(year => year!.Value)
            .Distinct()
            .ToList();

        if (detectedYears.Count == 0)
            return BadRequest(new { error = "Could not determine the season year. Include a four-digit year in eventKey." });
        if (detectedYears.Count > 1)
            return BadRequest(new { error = "One JSON file must describe exactly one season.", years = detectedYears });

        var detectedYear = detectedYears[0];
        var gameDataList = new List<GameData>();
        var teamsDict = new Dictionary<string, Team>();

        foreach (var item in matchElements)
        {
            if (item.TryGetProperty("participants", out var parts) && parts.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var p in parts.EnumerateArray()) AddTeamFromElement(p, teamsDict);
            }

            gameDataList.Add(new GameData
            {
                Year = detectedYear,
                TeamId = null,
                Data = JsonElementToBsonDocument(item),
                CreatedAt = System.DateTime.UtcNow
            });
        }

        var existingMatches = await _db.CountGameDataAsync(detectedYear);
        if (existingMatches > 0 && !replaceExisting)
            return Conflict(new
            {
                error = $"Season {detectedYear} already exists.",
                year = detectedYear,
                existingMatches
            });

        long replacedMatches;
        if (replaceExisting)
        {
            replacedMatches = await _db.ReplaceGameDataSeasonAsync(detectedYear, gameDataList);
        }
        else
        {
            await _db.CreateGameDataManyAsync(gameDataList);
            replacedMatches = 0;
        }

        if (teamsDict.Count > 0)
            await _db.UpsertTeamsAsync(teamsDict.Values.ToList());

        return Ok(new
        {
            year = detectedYear,
            playedMatches = gameDataList.Count,
            upsertedTeams = teamsDict.Count,
            replacedMatches
        });
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
