using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;

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

    // GET schema with its game data merged (JSON-friendly)
    [HttpGet("{year}/withdata")]
    public async Task<IActionResult> GetWithData(uint year)
    {
        var schema = await _dbService.GetSchemaAsync(year);
        if (schema is null) return NotFound();

        var gameDataList = await _dbService.GetGameDataAsync(year);

        var dataDtos = gameDataList.Select(gd => new
        {
            id = gd.Id.ToString(),
            teamId = gd.TeamId,
            data = ConvertBsonToClr(gd.Data),
            createdAt = gd.CreatedAt
        }).ToList();

        return Ok(new { schema = schema, gameData = dataDtos });
    }

    private object? ConvertBsonToClr(BsonValue? val)
    {
        if (val is null || val.IsBsonNull) return null;

        switch (val.BsonType)
        {
            case BsonType.Document:
                var doc = val.AsBsonDocument;
                var dict = new Dictionary<string, object?>();
                foreach (var e in doc)
                {
                    dict[e.Name] = ConvertBsonToClr(e.Value);
                }
                return dict;
            case BsonType.Array:
                var arr = val.AsBsonArray;
                var list = new List<object?>();
                foreach (var item in arr) list.Add(ConvertBsonToClr(item));
                return list;
            case BsonType.String:
                return val.AsString;
            case BsonType.Int32:
                return val.AsInt32;
            case BsonType.Int64:
                return val.AsInt64;
            case BsonType.Double:
                return val.AsDouble;
            case BsonType.Boolean:
                return val.AsBoolean;
            case BsonType.DateTime:
                return val.ToUniversalTime();
            default:
                return val.ToString();
        }
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
    // Basic validation: year must be non-zero and name must be provided.
    if (schema.Year == 0) return BadRequest(new { error = "Year must be a non-zero value." });
    if (string.IsNullOrWhiteSpace(schema.Name)) return BadRequest(new { error = "Name is required." });

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