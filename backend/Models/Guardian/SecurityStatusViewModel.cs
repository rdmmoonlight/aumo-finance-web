namespace AumoFinance.Models.Guardian;

public class SecurityStatusViewModel
{
    public bool EmailVerified { get; set; }

    public bool PasswordProtected { get; set; }

    public bool MultiFactorEnabled { get; set; }

    public bool RecoveryCodesAvailable { get; set; }
}
