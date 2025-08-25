using backend.Models;
using MongoDB.Driver;
using Microsoft.Extensions.Options;

namespace backend.Services;

public class DBService
{
    private readonly IMongoCollection<Team> _teams;

    public DBService(IOptions<DatabaseSettings> databaseSettings)
    {
        var mongoClient = new MongoClient(databaseSettings.Value.ConnectionString);
        var mongoDatabase = mongoClient.GetDatabase(databaseSettings.Value.DatabaseName);
        _teams = mongoDatabase.GetCollection<Team>("Teams");
    }

    public async Task<List<Team>> GetAsync() =>
        await _teams.Find(_ => true).ToListAsync();

    public async Task<Team?> GetAsync(string id) =>
        await _teams.Find(x => x.Id == id).FirstOrDefaultAsync();

    public async Task CreateAsync(Team team) =>
        await _teams.InsertOneAsync(team);

    public async Task UpdateAsync(string id, Team team) =>
        await _teams.ReplaceOneAsync(x => x.Id == id, team);

    public async Task RemoveAsync(string id) =>
        await _teams.DeleteOneAsync(x => x.Id == id);
}