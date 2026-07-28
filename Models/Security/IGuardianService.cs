using AumoFinance.Models.Security;

namespace AumoFinance.Services.Security;

public interface IGuardianService
{
    Task<List<UserSession>> GetActiveSessionsAsync(Guid userId);

    Task<List<LoginActivity>> GetLoginActivitiesAsync(Guid userId);

    Task RevokeSessionAsync(Guid sessionId, Guid userId);

    Task CreateSessionAsync(UserSession session);

    Task CreateLoginActivityAsync(LoginActivity activity);
}
