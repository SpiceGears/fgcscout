using backend.Models;
using MongoDB.Driver;
using Microsoft.Extensions.Options;

namespace backend.Services;

public class DBService
{
    private readonly IMongoCollection<Team> _teams;
    private readonly IMongoCollection<GameSchema> _schemas;

    public DBService(IOptions<DatabaseSettings> databaseSettings)
    {
        var mongoClient = new MongoClient(databaseSettings.Value.ConnectionString);
        var mongoDatabase = mongoClient.GetDatabase(databaseSettings.Value.DatabaseName);

        _teams = mongoDatabase.GetCollection<Team>("Teams");
        _schemas = mongoDatabase.GetCollection<GameSchema>("GameSchemas");
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
        await _schemas.InsertOneAsync(schema);

    public async Task UpdateSchemaAsync(uint year, GameSchema schema) =>
        await _schemas.ReplaceOneAsync(s => s.Year == year, schema);

    public async Task RemoveSchemaAsync(uint year) =>
        await _schemas.DeleteOneAsync(s => s.Year == year);
}