using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GameSchemaController : ControllerBase
{
    private readonly DBService _dbService;

    public GameSchemaController(DBService dbService)
    {
        _dbService = dbService;
    }

    // GET all schemas
    [HttpGet]
    public async Task<ActionResult<List<GameSchema>>> Get() =>
        await _dbService.GetSchemasAsync();

    // GET schema by year (id = Year)
    [HttpGet("{year}")]
    public async Task<ActionResult<GameSchema?>> Get(uint year)
    {
        var existingSchema = await _dbService.GetSchemaAsync(year);
        if (existingSchema is null) return NotFound();
        return existingSchema;
    }

    // POST new schema
    [HttpPost]
    public async Task<IActionResult> Post(GameSchema schema)
    {
        await _dbService.CreateSchemaAsync(schema);
        return CreatedAtAction(nameof(Get), new { year = schema.Year }, schema);
    }

    // PUT update schema
    [HttpPut("{year}")]
    public async Task<IActionResult> Put(uint year, GameSchema schema)
    {
        var existingSchema = await _dbService.GetSchemaAsync(year);
        if (existingSchema is null) return NotFound();

        await _dbService.UpdateSchemaAsync(year, schema);
        return NoContent();
    }

    // DELETE schema
    [HttpDelete("{year}")]
    public async Task<IActionResult> Delete(uint year)
    {
        var existingSchema = await _dbService.GetSchemaAsync(year);
        if (existingSchema is null) return NotFound();

        await _dbService.RemoveSchemaAsync(year);
        return NoContent();
    }
}