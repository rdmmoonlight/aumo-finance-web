namespace AumoFinance.Models.Guardian;

public class GuardianDashboardViewModel
{
    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public int SecurityScore { get; set; }

    public int ActiveSessions { get; set; }

    public int TrustedDevices { get; set; }

    public DateTime LastLogin { get; set; }

    public SecurityStatusViewModel Security { get; set; }
        = new();

    public List<LoginActivityViewModel> RecentActivities { get; set; }
        = new();
}
