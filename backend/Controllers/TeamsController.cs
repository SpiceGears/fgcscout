using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TeamsController : ControllerBase
        {
    private readonly DBService _dbService;

    public TeamsController(DBService dbService)
    {
        _dbService = dbService;
    }

    [HttpGet]
    public async Task<ActionResult<List<Team>>> Get() =>
        await _dbService.GetTeamsAsync();

    [HttpGet("{id}")]
    public async Task<ActionResult<Team?>> Get(string id)
    {
        var existingTeam = await _dbService.GetTeamAsync(id);
        if (existingTeam is null) return NotFound();
        return existingTeam;
    }

    [HttpPost]
    public async Task<IActionResult> Post(Team team)
    {
        await _dbService.CreateTeamAsync(team);
        return CreatedAtAction(nameof(Get), new { id = team.Id }, team);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Put(string id, Team team)
    {
        var existingTeam = await _dbService.GetTeamAsync(id);
        if (existingTeam is null) return NotFound();
        await _dbService.UpdateTeamAsync(id, team);
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var existingTeam = await _dbService.GetTeamAsync(id);
        if (existingTeam is null) return NotFound();
        await _dbService.RemoveTeamAsync(id);
        return NoContent();
    }
}