namespace AumoFinance.Models.Security;

public class TrustedDevice
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string DeviceName { get; set; } = string.Empty;

    public string DeviceIdentifier { get; set; } = string.Empty;

    public string Browser { get; set; } = string.Empty;

    public string OperatingSystem { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime LastUsedAt { get; set; }

    public bool IsTrusted { get; set; } = true;
}
