namespace AumoFinance.Models.Guardian;

public class ActiveSessionViewModel
{
    public string DeviceName { get; set; } = string.Empty;

    public string Browser { get; set; } = string.Empty;

    public string IpAddress { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public DateTime LastActivity { get; set; }

    public bool IsCurrent { get; set; }
}
