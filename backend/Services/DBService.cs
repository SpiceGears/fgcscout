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
    private readonly IMongoCollection<SeasonConfiguration> _seasonConfigurations;
    private readonly IMongoDatabase _database;

    public DBService(IOptions<DatabaseSettings> databaseSettings)
    {
        var settings = databaseSettings.Value;
        var connection = new MongoUrlBuilder(settings.ConnectionString);
        if (!string.IsNullOrWhiteSpace(settings.Username)) connection.Username = settings.Username;
        if (!string.IsNullOrWhiteSpace(settings.Password)) connection.Password = settings.Password;
        if (!string.IsNullOrWhiteSpace(settings.AuthenticationSource)) connection.AuthenticationSource = settings.AuthenticationSource;
        var mongoClient = new MongoClient(connection.ToMongoUrl());
        _database = mongoClient.GetDatabase(settings.DatabaseName);

        _teams = _database.GetCollection<Team>("Teams");
        _schemas = _database.GetCollection<GameSchema>("GameSchemas");
        _gameData = _database.GetCollection<GameData>("GameData");
        _seasonConfigurations = _database.GetCollection<SeasonConfiguration>("SeasonConfigurations");
    }

    public async Task PingAsync(CancellationToken cancellationToken = default) =>
        await _database.RunCommandAsync<BsonDocument>(new BsonDocument("ping", 1), cancellationToken: cancellationToken);

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

    public sealed record GameDataUpsertResult(int Inserted, int Updated);

    public async Task<GameDataUpsertResult> UpsertGameDataSeasonAsync(uint year, IReadOnlyCollection<GameData> data)
    {
        var existing = await GetGameDataAsync(year);
        var existingByKey = existing
            .Select(item => (Key: GetMatchSourceKey(item.Data), Item: item))
            .Where(item => item.Key is not null)
            .GroupBy(item => item.Key!, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First().Item, StringComparer.Ordinal);

        var writes = new List<WriteModel<GameData>>();
        var seenKeys = new HashSet<string>(StringComparer.Ordinal);
        var inserted = 0;
        var updated = 0;
        var now = DateTime.UtcNow;

        foreach (var incoming in data)
        {
            var key = GetMatchSourceKey(incoming.Data);
            if (key is null || !seenKeys.Add(key)) continue;

            incoming.Year = year;
            incoming.UpdatedAt = now;
            if (existingByKey.TryGetValue(key, out var stored))
            {
                if (stored.Data.TryGetValue("videoUrl", out var videoUrl) && !incoming.Data.Contains("videoUrl"))
                    incoming.Data["videoUrl"] = videoUrl;

                incoming.Id = stored.Id;
                incoming.CreatedAt = stored.CreatedAt;
                writes.Add(new ReplaceOneModel<GameData>(
                    Builders<GameData>.Filter.Eq(item => item.Id, stored.Id), incoming));
                updated++;
            }
            else
            {
                incoming.Id = ObjectId.GenerateNewId();
                incoming.CreatedAt = now;
                writes.Add(new InsertOneModel<GameData>(incoming));
                inserted++;
            }
        }

        if (writes.Count > 0)
            await _gameData.BulkWriteAsync(writes, new BulkWriteOptions { IsOrdered = false });

        return new GameDataUpsertResult(inserted, updated);
    }

    private static string? GetMatchSourceKey(BsonDocument data)
    {
        static string Read(BsonDocument document, string name) =>
            document.TryGetValue(name, out var value) && !value.IsBsonNull ? value.ToString() ?? string.Empty : string.Empty;

        var eventKey = Read(data, "eventKey");
        var tournamentKey = Read(data, "tournamentKey");
        var matchId = Read(data, "id");
        if (!string.IsNullOrWhiteSpace(matchId))
            return $"{eventKey}|{tournamentKey}|{matchId}";

        var name = Read(data, "name");
        var scheduledTime = Read(data, "scheduledTime");
        return string.IsNullOrWhiteSpace(name) ? null : $"{eventKey}|{tournamentKey}|{name}|{scheduledTime}";
    }

    public async Task<List<SeasonConfiguration>> GetSeasonConfigurationsAsync() =>
        await _seasonConfigurations.Find(_ => true).SortByDescending(item => item.Year).ToListAsync();

    public async Task<SeasonConfiguration?> GetSeasonConfigurationAsync(uint year) =>
        await _seasonConfigurations.Find(item => item.Year == year).FirstOrDefaultAsync();

    public async Task UpsertSeasonConfigurationAsync(SeasonConfiguration configuration) =>
        await _seasonConfigurations.ReplaceOneAsync(
            item => item.Year == configuration.Year,
            configuration,
            new ReplaceOptions { IsUpsert = true });

    public async Task RemoveSeasonConfigurationAsync(uint year) =>
        await _seasonConfigurations.DeleteOneAsync(item => item.Year == year);

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
