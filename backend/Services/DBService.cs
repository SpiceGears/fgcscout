using backend.Models;
using MongoDB.Bson;
using MongoDB.Driver;
using Microsoft.Extensions.Options;

namespace backend.Services;

public class DBService
{
    private readonly IMongoCollection<Team> _teams;
    private readonly IMongoCollection<GameSchema> _schemas;
    private readonly IMongoCollection<GameData> _gameData;

    public DBService(IOptions<DatabaseSettings> databaseSettings)
    {
        var mongoClient = new MongoClient(databaseSettings.Value.ConnectionString);
        var mongoDatabase = mongoClient.GetDatabase(databaseSettings.Value.DatabaseName);

        _teams = mongoDatabase.GetCollection<Team>("Teams");
        _schemas = mongoDatabase.GetCollection<GameSchema>("GameSchemas");
        _gameData = mongoDatabase.GetCollection<GameData>("GameData");
    }

    // ---------------- TEAM METHODS ----------------
    public async Task<List<Team>> GetTeamsAsync() =>
        await _teams.Find(_ => true).ToListAsync();

    public async Task<Team?> GetTeamAsync(string id) =>
        await _teams.Find(x => x.Id == id).FirstOrDefaultAsync();

    public async Task CreateTeamAsync(Team team) =>
        await _teams.InsertOneAsync(team);

    public async Task UpdateTeamAsync(string id, Team team) =>
        await _teams.ReplaceOneAsync(x => x.Id == id, team);

    public async Task RemoveTeamAsync(string id) =>
        await _teams.DeleteOneAsync(x => x.Id == id);

    // ---------------- SCHEMA METHODS ----------------
    public async Task<List<GameSchema>> GetSchemasAsync() =>
        await _schemas.Find(_ => true).ToListAsync();

    public async Task<GameSchema?> GetSchemaAsync(uint year) =>
        await _schemas.Find(s => s.Year == year).FirstOrDefaultAsync();

    public async Task CreateSchemaAsync(GameSchema schema) =>
        // Use upsert to avoid duplicate-key errors if a schema with the same Year already exists.
        await _schemas.ReplaceOneAsync(s => s.Year == schema.Year, schema, new MongoDB.Driver.ReplaceOptions { IsUpsert = true });

    public async Task UpdateSchemaAsync(uint year, GameSchema schema) =>
        await _schemas.ReplaceOneAsync(s => s.Year == year, schema);

    public async Task RemoveSchemaAsync(uint year) =>
        await _schemas.DeleteOneAsync(s => s.Year == year);

    // ---------------- GAME DATA METHODS ----------------
    public async Task<List<GameData>> GetGameDataAsync(uint year) =>
        await _gameData.Find(d => d.Year == year).ToListAsync();

    public async Task<List<uint>> GetGameDataYearsAsync()
    {
        using var cursor = await _gameData.DistinctAsync<uint>(
            "year",
            Builders<GameData>.Filter.Empty);
        return await cursor.ToListAsync();
    }

    public async Task<long> CountGameDataAsync(uint year) =>
        await _gameData.CountDocumentsAsync(d => d.Year == year);

    public async Task<long> RemoveGameDataSeasonAsync(uint year)
    {
        var result = await _gameData.DeleteManyAsync(d => d.Year == year);
        return result.DeletedCount;
    }

    public async Task<long> ReplaceGameDataSeasonAsync(uint year, IReadOnlyCollection<GameData> data)
    {
        var deleted = await RemoveGameDataSeasonAsync(year);
        if (data.Count > 0)
        {
            await _gameData.InsertManyAsync(data);
        }

        return deleted;
    }

    public async Task CreateGameDataAsync(GameData data) =>
        await _gameData.InsertOneAsync(data);

    public async Task<GameData?> GetGameDataAsync(ObjectId id) =>
        await _gameData.Find(d => d.Id == id).FirstOrDefaultAsync();

    public async Task<GameData?> GetGameDataAsync(string id)
    {
        if (!ObjectId.TryParse(id, out var objectId))
        {
            return null;
        }
        return await GetGameDataAsync(objectId);
    }

    public async Task<bool> UpdateMatchVideoAsync(string id, string? videoUrl)
    {
        if (!ObjectId.TryParse(id, out var objectId))
            return false;

        var field = "data.videoUrl";
        UpdateDefinition<GameData> update = string.IsNullOrWhiteSpace(videoUrl)
            ? Builders<GameData>.Update.Unset(field)
            : Builders<GameData>.Update.Set(field, videoUrl.Trim());
        var result = await _gameData.UpdateOneAsync(d => d.Id == objectId, update);
        return result.MatchedCount > 0;
    }

    // Bulk insert many GameData documents
    public async Task CreateGameDataManyAsync(IEnumerable<GameData> data) =>
        await _gameData.InsertManyAsync(data);

    // Upsert many teams: replace by Id with upsert
    public async Task UpsertTeamsAsync(IEnumerable<Team> teams)
    {
        var models = new List<WriteModel<Team>>();
        foreach (var t in teams)
        {
            var filter = Builders<Team>.Filter.Eq(x => x.Id, t.Id);
            var replace = new ReplaceOneModel<Team>(filter, t) { IsUpsert = true };
            models.Add(replace);
        }

        if (models.Count > 0)
        {
            await _teams.BulkWriteAsync(models);
        }
    }
}
