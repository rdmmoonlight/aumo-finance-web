namespace AumoFinance.Models.Guardian;

public class LoginActivityViewModel
{
    public string Activity { get; set; } = string.Empty;

    public string Device { get; set; } = string.Empty;

    public string Browser { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public string IpAddress { get; set; } = string.Empty;

    public DateTime OccurredAt { get; set; }
}
