using AumoFinance.Models.Security;

namespace AumoFinance.Models.Guardian;

public class GuardianViewModel
{
    public List<UserSession> Sessions { get; set; } = new();
    public List<LoginActivity> Activities { get; set; } = new();
}

public class GuardianDashboardViewModel
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int SecurityScore { get; set; }
    public int ActiveSessions { get; set; }
    public int TrustedDevices { get; set; }
    public DateTime LastLogin { get; set; }

    public SecurityStatusViewModel Security { get; set; } = new();
    public List<LoginActivityViewModel> RecentActivities { get; set; } = new();
}

public class ActiveSessionViewModel
{
    public string DeviceName { get; set; } = string.Empty;
    public string Browser { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public DateTime LastActivity { get; set; }
    public bool IsCurrent { get; set; }
}

public class LoginActivityViewModel
{
    public string Activity { get; set; } = string.Empty;
    public string Device { get; set; } = string.Empty;
    public string Browser { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; }
}

public class SecurityStatusViewModel
{
    public bool EmailVerified { get; set; }
    public bool PasswordProtected { get; set; }
    public bool MultiFactorEnabled { get; set; }
    public bool RecoveryCodesAvailable { get; set; }
}

public class TrustedDeviceViewModel
{
    public string Name { get; set; } = string.Empty;
    public string Browser { get; set; } = string.Empty;
    public DateTime AddedOn { get; set; }
}
