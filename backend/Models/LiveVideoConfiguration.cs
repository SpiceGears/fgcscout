using MongoDB.Bson.Serialization.Attributes;

namespace backend.Models;

public sealed class LiveVideoConfiguration
{
    [BsonId] public uint Year { get; set; }
    public bool Enabled { get; set; }
    public long Revision { get; set; }
    public List<LiveVideoStream> Streams { get; set; } = [];
    public DateTime? WorkerSeenAt { get; set; }
    public int PendingCount { get; set; }
    public string? WorkerError { get; set; }
    public List<LiveVideoStreamStatus> StreamStatuses { get; set; } = [];
}

public sealed class LiveVideoStream
{
    public int Field { get; set; }
    public string Url { get; set; } = "";
    public int MatchDuration { get; set; } = 150;
    public string? EventKey { get; set; }
    public string? TournamentKey { get; set; }
    public DateTimeOffset? OriginUtc { get; set; }
    public double[] ClockRoi { get; set; } = [.447, .800, .108, .075];
    public double[] IdentityRoi { get; set; } = [.32, .958, .122, .037];
}

public sealed record LiveVideoStreamStatus(int Field, string Status, string? Error, double? LastVideoTimestamp);
