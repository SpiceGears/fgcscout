using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using System.Text.Json;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GameDataController : ControllerBase
{
    private readonly DBService _db;

    public GameDataController(DBService db)
    {
        _db = db;
    }

    // GET all game data for a season (year) - returns DTOs with CLR-friendly types
    [HttpGet("{year}")]
    public async Task<ActionResult<List<object>>> Get(uint year)
    {
        var list = await _db.GetGameDataAsync(year);
        var dtoList = list.Select(MapGameDataToDto).ToList<object>();
        return dtoList;
    }

    // POST game data for a year. Body should be a JSON object matching schema.
    // Use JsonElement here so Swagger/OpenAPI produces standard JSON examples instead of BSON internals.
    [HttpPost("{year}")]
    public async Task<IActionResult> Post(uint year, [FromBody] JsonElement payload)
    {
        var schema = await _db.GetSchemaAsync(year);
        if (schema is null) return NotFound(new { error = "Schema for year not found" });

        // Validate payload against schema
        var errors = ValidateAgainstSchema(payload, schema);
        if (errors.Any()) return BadRequest(new { errors });

        // Convert JSON payload to BsonDocument for storage
        var bson = JsonElementToBsonDocument(payload);

        var gameData = new GameData
        {
            Year = year,
            Data = bson,
        };

        await _db.CreateGameDataAsync(gameData);
        var dto = MapGameDataToDto(gameData);
        return CreatedAtAction(nameof(Get), new { year = year }, dto);
    }

    // Map GameData to a DTO with CLR types for JSON serialization
    private object MapGameDataToDto(GameData gd)
    {
        return new
        {
            id = gd.Id.ToString(),
            year = gd.Year,
            teamId = gd.TeamId,
            data = ConvertBsonToClr(gd.Data),
            createdAt = gd.CreatedAt
        };
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
                // BsonDateTime maps to DateTime
                return val.ToUniversalTime();
            default:
                // Fallback to raw representation
                return val.ToString();
        }
    }

    private List<string> ValidateAgainstSchema(JsonElement payload, GameSchema schema)
    {
        var errs = new List<string>();

        foreach (var comp in schema.schema)
        {
            if (!payload.TryGetProperty(comp.Name, out var prop) || prop.ValueKind == JsonValueKind.Null)
            {
                if (!comp.Nullable)
                    errs.Add($"Field '{comp.Name}' is required but missing or null.");
                continue;
            }

            switch (comp.Type)
            {
                case ComponentType.Number:
                    if (!(prop.ValueKind == JsonValueKind.Number))
                        errs.Add($"Field '{comp.Name}' must be a number.");
                    break;
                case ComponentType.Boolean:
                    if (!(prop.ValueKind == JsonValueKind.True || prop.ValueKind == JsonValueKind.False))
                        errs.Add($"Field '{comp.Name}' must be a boolean.");
                    break;
                case ComponentType.String:
                    if (prop.ValueKind != JsonValueKind.String)
                        errs.Add($"Field '{comp.Name}' must be a string.");
                    break;
                default:
                    errs.Add($"Field '{comp.Name}' has unknown type.");
                    break;
            }
        }

        return errs;
    }

    private BsonDocument JsonElementToBsonDocument(JsonElement el)
    {
        var doc = new BsonDocument();
        if (el.ValueKind != JsonValueKind.Object) return doc;

        foreach (var prop in el.EnumerateObject())
        {
            doc[prop.Name] = ConvertJsonElementToBsonValue(prop.Value);
        }

        return doc;
    }

    private BsonValue ConvertJsonElementToBsonValue(JsonElement el)
    {
        switch (el.ValueKind)
        {
            case JsonValueKind.Object:
                return JsonElementToBsonDocument(el);
            case JsonValueKind.Array:
                var arr = new BsonArray();
                foreach (var item in el.EnumerateArray()) arr.Add(ConvertJsonElementToBsonValue(item));
                return arr;
            case JsonValueKind.String:
                return new BsonString(el.GetString() ?? string.Empty);
            case JsonValueKind.Number:
                if (el.TryGetInt64(out var l)) return new BsonInt64(l);
                if (el.TryGetDouble(out var d)) return new BsonDouble(d);
                return new BsonDouble(0);
            case JsonValueKind.True:
                return BsonBoolean.True;
            case JsonValueKind.False:
                return BsonBoolean.False;
            case JsonValueKind.Null:
            default:
                return BsonNull.Value;
        }
    }
}
