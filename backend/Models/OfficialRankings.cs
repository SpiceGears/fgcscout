using MongoDB.Bson.Serialization.Attributes;
namespace backend.Models;
public sealed class OfficialRankings
{
    [BsonId] public uint Year { get; set; }
    public string Json { get; set; } = "[]";
    public DateTime UpdatedAt { get; set; }
}
