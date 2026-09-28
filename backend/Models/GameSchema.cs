using System.ComponentModel.DataAnnotations;
using MongoDB.Bson.Serialization.Attributes;

public class GameSchema
{
    [Key]
    [BsonId]
    public uint Year { get; set; }

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty; //season name ex. FIRST Global Panama City 2025


    public List<SchemaComponent> schema { get; set; } = [];
}


public class SchemaComponent
{
    public ComponentType Type { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool Nullable { get; set; }
}



public enum ComponentType
{
    Number,
    Boolean,
    String
}
