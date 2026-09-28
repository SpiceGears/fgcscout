using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace backend.Services;

public sealed class DatabaseHealthCheck : IHealthCheck
{
    private readonly DBService _db;

    public DatabaseHealthCheck(DBService db) => _db = db;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await _db.PingAsync(cancellationToken);
            return HealthCheckResult.Healthy("MongoDB is reachable.");
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy("MongoDB is unavailable.", exception);
        }
    }
}
