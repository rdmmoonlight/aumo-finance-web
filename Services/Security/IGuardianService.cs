using AumoFinance.Models.Security;

namespace AumoFinance.Services.Security;

public interface IGuardianService
{
    Task CreateLoginActivityAsync(
        Guid userId,
        string activityType,
        string device,
        string browser,
        string ipAddress,
        string country,
        bool isSuccess
    );

    Task CreateSessionAsync(
        Guid userId,
        string deviceName,
        string browser,
        string ipAddress,
        string country,
        string refreshTokenHash
    );

    Task<List<UserSession>> GetActiveSessionsAsync(Guid userId);

    Task RevokeSessionAsync(Guid sessionId, Guid userId);

    /// <summary>
    /// Revokes all active sessions for a given user (Emergency Kill Switch).
    /// </summary>
    Task RevokeAllSessionsAsync(Guid userId);

    Task<List<LoginActivity>> GetLoginActivitiesAsync(Guid userId);
}
