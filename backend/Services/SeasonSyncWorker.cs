namespace backend.Services;

public sealed class SeasonSyncWorker : BackgroundService
{
    private readonly DBService _db;
    private readonly SeasonSyncService _syncService;
    private readonly ILogger<SeasonSyncWorker> _logger;

    public SeasonSyncWorker(DBService db, SeasonSyncService syncService, ILogger<SeasonSyncWorker> logger)
    {
        _db = db;
        _syncService = syncService;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            var now = DateTime.UtcNow;
            var configurations = await _db.GetSeasonConfigurationsAsync();
            foreach (var configuration in configurations.Where(item => item.SyncEnabled))
            {
                var interval = TimeSpan.FromMinutes(Math.Clamp(configuration.SyncIntervalMinutes, 1, 1440));
                if (configuration.LastSyncAt.HasValue && now - configuration.LastSyncAt.Value < interval) continue;
                try
                {
                    var result = await _syncService.SyncAsync(configuration.Year, stoppingToken);
                    _logger.LogInformation(
                        "Season {Year} synced: {Matches} matches ({Inserted} inserted, {Updated} updated).",
                        result.Year, result.MatchCount, result.InsertedMatches, result.UpdatedMatches);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception exception)
                {
                    _logger.LogWarning(exception, "Season {Year} synchronization failed.", configuration.Year);
                }
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
