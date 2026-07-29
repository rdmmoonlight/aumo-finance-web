namespace AumoFinance.Models.Security;

public class SecuritySetting
{
    public Guid UserId { get; set; }

    public ApplicationUser User { get; set; } = null!;

    public bool EmailVerified { get; set; }

    public bool TwoFactorEnabled { get; set; }

    public bool LoginNotificationEnabled { get; set; }

    public int SessionTimeoutMinutes { get; set; } = 30;

    public DateTime UpdatedAt { get; set; }
}
