using System.Text.Json;
using System.Text.RegularExpressions;
using backend.Models;
using MongoDB.Bson;

namespace backend.Services;

public sealed class SeasonImportService
{
    private readonly DBService _db;

    public SeasonImportService(DBService db) => _db = db;

    public sealed record ImportResult(
        uint Year,
        int MatchCount,
        int UpsertedTeams,
        long ReplacedMatches,
        int InsertedMatches,
        int UpdatedMatches);

    public async Task<ImportResult> ImportAsync(
        JsonElement payload,
        bool replaceExisting,
        uint? expectedYear = null,
        CancellationToken cancellationToken = default)
    {
        var matches = GetMatches(payload);
        if (matches.Count == 0)
            throw new InvalidOperationException("The source does not contain any matches.");

        var detectedYears = matches
            .Select(TryGetYear)
            .Where(year => year.HasValue)
            .Select(year => year!.Value)
            .Distinct()
            .ToList();

        if (detectedYears.Count > 1)
            throw new InvalidOperationException($"The source contains multiple seasons: {string.Join(", ", detectedYears)}.");

        var year = detectedYears.FirstOrDefault();
        if (year == 0) year = expectedYear ?? throw new InvalidOperationException("Could not determine the season year.");
        if (expectedYear.HasValue && year != expectedYear.Value)
            throw new InvalidOperationException($"The source contains season {year}, but season {expectedYear.Value} was configured.");

        var root = payload;
        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var wrapped) && wrapped.ValueKind == JsonValueKind.Object) root = wrapped;
        string? rankingsJson = null;
        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("rankings", out var rankings))
        {
            if (rankings.ValueKind != JsonValueKind.Array || rankings.GetArrayLength() > 10000)
                throw new InvalidOperationException("Expected an official rankings array with at most 10,000 teams.");
            foreach (var row in rankings.EnumerateArray())
                if (row.ValueKind != JsonValueKind.Object || TryGetYear(row) is uint rankingYear && rankingYear != year)
                    throw new InvalidOperationException("Rankings must belong to the imported season.");
            rankingsJson = rankings.GetRawText();
        }

        var gameData = new List<GameData>();
        var teams = new Dictionary<string, Team>(StringComparer.Ordinal);
        foreach (var match in matches)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (match.TryGetProperty("participants", out var participants) && participants.ValueKind == JsonValueKind.Array)
            {
                foreach (var participant in participants.EnumerateArray()) AddTeam(participant, teams);
            }

            gameData.Add(new GameData
            {
                Year = year,
                Data = ToBsonDocument(match),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        long replaced = 0;
        var inserted = 0;
        var updated = 0;
        if (replaceExisting)
        {
            replaced = await _db.ReplaceGameDataSeasonAsync(year, gameData);
            inserted = gameData.Count;
        }
        else
        {
            var result = await _db.UpsertGameDataSeasonAsync(year, gameData);
            inserted = result.Inserted;
            updated = result.Updated;
        }

        if (rankingsJson is not null) await _db.SaveOfficialRankingsAsync(year, rankingsJson);
        else if (replaceExisting) await _db.RemoveOfficialRankingsAsync(year);

        if (teams.Count > 0) await _db.UpsertTeamsAsync(teams.Values);

        var config = await _db.GetSeasonConfigurationAsync(year);
        if (config is null)
        {
            await _db.UpsertSeasonConfigurationAsync(new SeasonConfiguration
            {
                Year = year,
                Name = $"FIRST Global Challenge {year}"
            });
        }

        return new ImportResult(year, gameData.Count, teams.Count, replaced, inserted, updated);
    }

    private static List<JsonElement> GetMatches(JsonElement payload)
    {
        if (payload.ValueKind == JsonValueKind.Array) return payload.EnumerateArray().ToList();
        if (payload.ValueKind != JsonValueKind.Object) throw new InvalidOperationException("Expected a JSON object or array.");
        if (payload.TryGetProperty("matches", out var matches) && matches.ValueKind == JsonValueKind.Array)
            return matches.EnumerateArray().ToList();
        if (payload.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Object &&
            data.TryGetProperty("matches", out matches) && matches.ValueKind == JsonValueKind.Array)
            return matches.EnumerateArray().ToList();
        throw new InvalidOperationException("Expected a 'matches' array.");
    }

    private static uint? TryGetYear(JsonElement match)
    {
        if (match.TryGetProperty("eventKey", out var eventKey) && eventKey.ValueKind == JsonValueKind.String)
        {
            var value = Regex.Match(eventKey.GetString() ?? string.Empty, "(\\d{4})").Value;
            if (uint.TryParse(value, out var year)) return year;
        }
        return null;
    }

    private static void AddTeam(JsonElement element, IDictionary<string, Team> teams)
    {
        var id = ReadStringOrNumber(element, "teamKey") ?? ReadStringOrNumber(element, "id");
        if (string.IsNullOrWhiteSpace(id) || teams.ContainsKey(id)) return;

        teams[id] = new Team
        {
            Id = id,
            Country = ReadString(element, "country") ?? string.Empty,
            CountryCode = ReadString(element, "countryCode") ?? string.Empty,
            Disqualified = ReadBoolean(element, "disqualified")
        };
    }

    private static string? ReadString(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static string? ReadStringOrNumber(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value)) return null;
        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null
        };
    }

    private static bool ReadBoolean(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value)) return false;
        return value.ValueKind == JsonValueKind.True ||
               (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number) && number != 0);
    }

    private static BsonDocument ToBsonDocument(JsonElement element)
    {
        var document = new BsonDocument();
        foreach (var property in element.EnumerateObject()) document[property.Name] = ToBsonValue(property.Value);
        return document;
    }

    private static BsonValue ToBsonValue(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.Object => ToBsonDocument(element),
        JsonValueKind.Array => new BsonArray(element.EnumerateArray().Select(ToBsonValue)),
        JsonValueKind.String => new BsonString(element.GetString() ?? string.Empty),
        JsonValueKind.Number when element.TryGetInt64(out var integer) => new BsonInt64(integer),
        JsonValueKind.Number when element.TryGetDouble(out var number) => new BsonDouble(number),
        JsonValueKind.True => BsonBoolean.True,
        JsonValueKind.False => BsonBoolean.False,
        _ => BsonNull.Value
    };
}
