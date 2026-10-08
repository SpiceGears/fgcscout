using MongoDB.Bson.Serialization.Attributes;

namespace backend.Models;

public class SeasonConfiguration
{
    [BsonId]
    public uint Year { get; set; }

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("sourceUrl")]
    public string SourceUrl { get; set; } = "https://api.first.global/v1";

    [BsonElement("syncEnabled")]
    public bool SyncEnabled { get; set; }

    [BsonElement("syncIntervalMinutes")]
    public int SyncIntervalMinutes { get; set; } = 5;

    [BsonElement("lastSyncAt")]
    public DateTime? LastSyncAt { get; set; }

    [BsonElement("lastSyncError")]
    public string? LastSyncError { get; set; }

    [BsonElement("lastSyncMatchCount")]
    public int? LastSyncMatchCount { get; set; }
}
