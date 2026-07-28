namespace AumoFinance.Models.Security;

public class LoginActivity
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public ApplicationUser User { get; set; } = null!;

    public string ActivityType { get; set; } = string.Empty;

    public string Device { get; set; } = string.Empty;

    public string Browser { get; set; } = string.Empty;

    public string IpAddress { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public bool IsSuccess { get; set; }

    public DateTime CreatedAt { get; set; }
}
