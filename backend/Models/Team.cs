using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace backend.Models
{
    public class Team
    {
        [BsonId]
        public string Id { get; set; } = null!;

        [BsonElement("Country")]
        public string Country { get; set; } = null!;

        [BsonElement("CountryCode")]
        public string CountryCode { get; set; } = null!;
        [BsonElement("Disqualified")]
        public bool Disqualified { get; set; }
    }
}