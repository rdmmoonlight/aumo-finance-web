namespace AumoFinance.Models.Security;

public class RecoveryCode
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string CodeHash { get; set; } = string.Empty;

    public bool Used { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UsedAt { get; set; }
}
