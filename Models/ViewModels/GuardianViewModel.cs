using AumoFinance.Models.Security;

namespace AumoFinance.Models;

public class GuardianViewModel
{
    public List<UserSession> Sessions { get; set; } = new();

    public List<LoginActivity> Activities { get; set; } = new();
}
