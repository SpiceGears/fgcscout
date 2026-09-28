using System;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace backend.Models
{
    public class GameData
    {
        [BsonId]
        public ObjectId Id { get; set; }

        [BsonElement("year")]
        public uint Year { get; set; }

        [BsonElement("teamId")]
        public string? TeamId { get; set; }

        // The actual payload captured for the game (flexible schema)
        [BsonElement("data")]
        public BsonDocument Data { get; set; } = new BsonDocument();

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("updatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
