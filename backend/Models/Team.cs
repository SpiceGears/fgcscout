using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace backend.Models
{
    public class Team
    {
        [BsonId]
        public string Id { get; set; } = null!;

        [BsonElement("country")]
        public string Country { get; set; } = null!;

        [BsonElement("countryCode")]
        public string CountryCode { get; set; } = null!;
        [BsonElement("disqualified")]
        public bool Disqualified { get; set; }
    }
}