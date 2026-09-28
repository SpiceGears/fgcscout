using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SeasonsController : ControllerBase
{
    private readonly DBService _db;

    public SeasonsController(DBService db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var years = await _db.GetGameDataYearsAsync();
        var configurations = (await _db.GetSeasonConfigurationsAsync()).ToDictionary(item => item.Year);
        var allYears = years.Concat(configurations.Keys).Distinct().OrderByDescending(year => year);
        var result = new List<object>();
        foreach (var year in allYears)
        {
            configurations.TryGetValue(year, out var configuration);
            result.Add(new
            {
                year,
                name = configuration?.Name ?? $"FIRST Global Challenge {year}",
                matchCount = await _db.CountGameDataAsync(year),
                live = configuration?.SyncEnabled ?? false,
                lastSyncAt = configuration?.LastSyncAt
            });
        }
        return Ok(result);
    }
}
