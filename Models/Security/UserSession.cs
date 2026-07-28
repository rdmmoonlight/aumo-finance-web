namespace AumoFinance.Models.Security;

public class UserSession
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public ApplicationUser User { get; set; } = null!;

    public string DeviceName { get; set; } = string.Empty;

    public string Browser { get; set; } = string.Empty;

    public string IpAddress { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public string RefreshTokenHash { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public bool IsCurrent { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime LastActivityAt { get; set; }

    public DateTime? RevokedAt { get; set; }
}
