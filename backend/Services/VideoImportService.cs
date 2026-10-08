using backend.Models;
using MongoDB.Bson;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace backend.Services;

public sealed record VideoImportEntry(
    string? Url,
    [property: JsonPropertyName("start_timestamp")] double StartTimestamp,
    [property: JsonPropertyName("end_timestamp")] double EndTimestamp,
    string? MatchId = null, int? Field = null,
    [property: JsonPropertyName("match_number")] int? MatchNumber = null,
    [property: JsonPropertyName("event_key")] string? EventKey = null,
    [property: JsonPropertyName("tournament_key")] string? TournamentKey = null);
public sealed record VideoImportRow(int Index, string Status, string? MatchId, string? MatchName, string? Message, string? DetectionId);

public static class VideoImportService
{
    public static string Read(BsonDocument data, string key) =>
        data.TryGetValue(key, out var value) && !value.IsBsonNull ? value.ToString() ?? "" : "";

    public static string? VideoId(string? url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != "https" ||
            !string.IsNullOrEmpty(uri.UserInfo) || !uri.IsDefaultPort) return null;
        string? id = null;
        if (uri.Host is "youtu.be" or "www.youtu.be") id = uri.AbsolutePath.Trim('/');
        else if (uri.Host is "youtube.com" or "www.youtube.com" or "m.youtube.com")
        {
            if (uri.AbsolutePath.StartsWith("/live/")) id = uri.AbsolutePath.Split('/').ElementAtOrDefault(2);
            else id = uri.Query.TrimStart('?').Split('&').Select(part => part.Split('=', 2))
                .FirstOrDefault(part => part.Length == 2 && part[0] == "v")?.ElementAtOrDefault(1);
        }
        return id is not null && Regex.IsMatch(id, "^[A-Za-z0-9_-]{11}$") ? id : null;
    }

    private static string DetectionId(uint year, GameData match, VideoImportEntry entry)
    {
        var signature = FormattableString.Invariant($"archive|{year}|{match.Id}|{VideoId(entry.Url)}|{entry.StartTimestamp:R}|{entry.EndTimestamp:R}");
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(signature))).ToLowerInvariant()[..32];
    }

    public static VideoImportRow Preview(int index, uint year, VideoImportEntry entry, IReadOnlyList<GameData> matches)
    {
        if (VideoId(entry.Url) is null || !double.IsFinite(entry.StartTimestamp) || !double.IsFinite(entry.EndTimestamp) ||
            entry.StartTimestamp < 0 || entry.EndTimestamp <= entry.StartTimestamp || entry.EndTimestamp > 31_536_000)
            return new(index, "invalid", null, null, "Use a YouTube URL and finite start/end seconds with end after start.", null);
        var candidates = matches.Where(match => match.Year == year);
        if (!string.IsNullOrWhiteSpace(entry.MatchId)) candidates = candidates.Where(match => match.Id.ToString() == entry.MatchId);
        else if (entry.MatchNumber.HasValue)
        {
            candidates = candidates.Where(match => (!entry.Field.HasValue || Read(match.Data, "field") == entry.Field.Value.ToString(CultureInfo.InvariantCulture)) &&
                Regex.IsMatch(Read(match.Data, "name"), $"^(?:Qualification|Ranking) Match {entry.MatchNumber.Value}$", RegexOptions.IgnoreCase));
        }
        else
        {
            // Recover assignments from an earlier partial upload of the same raw JSON.
            candidates = candidates.Where(match => Read(match.Data, "videoDetectionId") == DetectionId(year, match, entry));
            if (!candidates.Any()) return new(index, "unassigned", null, null, "Select the match for this recording.", null);
        }
        if (!string.IsNullOrWhiteSpace(entry.EventKey)) candidates = candidates.Where(match => Read(match.Data, "eventKey") == entry.EventKey);
        if (!string.IsNullOrWhiteSpace(entry.TournamentKey)) candidates = candidates.Where(match => Read(match.Data, "tournamentKey") == entry.TournamentKey);
        var found = candidates.ToList();
        if (found.Count != 1) return new(index, found.Count == 0 ? "not_found" : "ambiguous", null, null,
            found.Count == 0 ? "Match not found in this season." : "Several matches fit. Select one explicitly.", null);
        var selected = found[0];
        var detectionId = DetectionId(year, selected, entry);
        var assignedUrl = Read(selected.Data, "videoUrl");
        var same = Read(selected.Data, "videoDetectionId") == detectionId;
        return new(index, same ? "already_imported" : string.IsNullOrWhiteSpace(assignedUrl) ? "ready" : "conflict",
            selected.Id.ToString(), Read(selected.Data, "name"), same ? "Already imported; repeating the upload is safe." :
            string.IsNullOrWhiteSpace(assignedUrl) ? null : "This match already has a recording. Edit it on the match page to replace it.", detectionId);
    }
}
