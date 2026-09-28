namespace backend.Models;

public class DatabaseSettings
{
    public string ConnectionString { get; set; } = null!;
    public string DatabaseName { get; set; } = null!;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? AuthenticationSource { get; set; }
}
