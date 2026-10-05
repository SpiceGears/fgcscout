using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/admin")]
public sealed class VideoAdminController(DBService db) : ControllerBase
{
    public sealed record VideoImportRequest(List<VideoImportEntry>? Entries, bool DryRun = true);
    public sealed record LiveConfigurationRequest(bool Enabled, List<LiveVideoStream>? Streams);
    public sealed record WorkerStatusRequest(long Revision, int PendingCount, string? Error, List<LiveVideoStreamStatus>? Streams);

    [HttpPost("seasons/{year:int}/videos/import")]
    public async Task<IActionResult> ImportVideos(uint year, [FromBody] VideoImportRequest request)
    {
        if (request.Entries is null || request.Entries.Count is < 1 or > 2000)
            return BadRequest(new { error = "Upload between 1 and 2,000 recordings at a time." });
        var matches = await db.GetGameDataAsync(year);
        if (matches.Count == 0) return NotFound(new { error = "Import this season's match data first." });
        var rows = request.Entries.Select((entry, index) => VideoImportService.Preview(index, year, entry, matches)).ToList();
        var duplicateIds = rows.Where(row => row.MatchId is not null).GroupBy(row => row.MatchId)
            .Where(group => group.Count() > 1).Select(group => group.Key).ToHashSet();
        rows = rows.Select(row => duplicateIds.Contains(row.MatchId) ? row with { Status = "duplicate", Message = "Choose only one recording per match in this upload." } : row).ToList();
        if (!request.DryRun)
        {
            for (var i = 0; i < rows.Count; i++)
            {
                var row = rows[i];
                if (row.Status != "ready") continue;
                var entry = request.Entries[i];
                var url = $"https://www.youtube.com/watch?v={VideoImportService.VideoId(entry.Url)}&t={(long)Math.Floor(entry.StartTimestamp)}s&end={(long)Math.Ceiling(entry.EndTimestamp)}";
                var updated = await db.UpdateMatchVideoAsync(row.MatchId!, url, entry.StartTimestamp, entry.EndTimestamp, "complete", row.DetectionId, true);
                rows[i] = row with { Status = updated ? "imported" : "conflict", Message = updated ? null : "Match changed while importing; preview again." };
            }
        }
        return Ok(new { dryRun = request.DryRun, rows, imported = rows.Count(row => row.Status == "imported"), ready = rows.Count(row => row.Status == "ready") });
    }

    [HttpGet("live-video/configurations")]
    public async Task<IActionResult> GetConfigurations() => Ok(await db.GetLiveVideoConfigurationsAsync());

    [HttpGet("seasons/{year:int}/live-video")]
    public async Task<IActionResult> GetConfiguration(uint year) =>
        Ok(await db.GetLiveVideoConfigurationAsync(year) ?? new LiveVideoConfiguration { Year = year });

    [HttpPut("seasons/{year:int}/live-video")]
    public async Task<IActionResult> ConfigureLive(uint year, [FromBody] LiveConfigurationRequest request)
    {
        if (year is < 2017 or > 2100) return BadRequest(new { error = "Invalid season year." });
        if (request.Streams is null || request.Streams.Count > 20 || request.Enabled && request.Streams.Count == 0)
            return BadRequest(new { error = "Configure 1–20 field streams to enable watching." });
        var fields = new HashSet<int>();
        var urls = new HashSet<string>();
        foreach (var stream in request.Streams)
        {
            var id = VideoImportService.VideoId(stream.Url);
            if (stream.Field is < 1 or > 100 || !fields.Add(stream.Field) || id is null || !urls.Add(id))
                return BadRequest(new { error = "Each stream needs a unique field and a valid, unique YouTube URL." });
            if (stream.MatchDuration is < 30 or > 600 || !ValidRoi(stream.ClockRoi) || !ValidRoi(stream.IdentityRoi) ||
                (stream.EventKey?.Length ?? 0) > 120 || (stream.TournamentKey?.Length ?? 0) > 120)
                return BadRequest(new { error = "Invalid duration, scoreboard crop or event/tournament key." });
            stream.Url = $"https://www.youtube.com/watch?v={id}";
        }
        if (await db.GetSeasonConfigurationAsync(year) is null && await db.CountGameDataAsync(year) == 0)
            return BadRequest(new { error = "Add this season in the season settings first." });
        await db.SaveLiveVideoConfigurationAsync(year, request.Enabled, request.Streams);
        return Ok(await db.GetLiveVideoConfigurationAsync(year));
    }

    [HttpPut("seasons/{year:int}/live-video/status")]
    public async Task<IActionResult> ReportStatus(uint year, [FromBody] WorkerStatusRequest request)
    {
        if (request.PendingCount is < 0 or > 100000 || (request.Error?.Length ?? 0) > 500 ||
            request.Streams is null || request.Streams.Count > 20 || request.Streams.Any(stream =>
                stream.Field is < 1 or > 100 || stream.Status is not ("starting" or "watching" or "retrying" or "stream_ended" or "paused" or "restarting") ||
                (stream.Error?.Length ?? 0) > 500 || stream.LastVideoTimestamp.HasValue && (!double.IsFinite(stream.LastVideoTimestamp.Value) || stream.LastVideoTimestamp < 0)))
            return BadRequest(new { error = "Invalid worker status." });
        var accepted = await db.ReportLiveVideoStatusAsync(year, request.Revision, request.PendingCount, request.Error, request.Streams);
        return accepted ? Ok(new { accepted = true }) : Conflict(new { error = "Configuration changed. Reload it before reporting status." });
    }

    private static bool ValidRoi(double[]? roi) => roi is { Length: 4 } && roi.All(double.IsFinite) &&
        roi[0] >= 0 && roi[1] >= 0 && roi[2] > 0 && roi[3] > 0 && roi[0] + roi[2] <= 1 && roi[1] + roi[3] <= 1;
}
