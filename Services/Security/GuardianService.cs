using AumoFinance.Models;
using AumoFinance.Models.Security;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Services.Security;

public class GuardianService : IGuardianService
{
    private readonly AppDbContext _context;

    public GuardianService(AppDbContext context)
    {
        _context = context;
    }


    public async Task CreateLoginActivityAsync(
        Guid userId,
        string activityType,
        string device,
        string browser,
        string ipAddress,
        string country,
        bool isSuccess)
    {
        var activity = new LoginActivity
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ActivityType = activityType,
            Device = device,
            Browser = browser,
            IpAddress = ipAddress,
            Country = country,
            IsSuccess = isSuccess,
            CreatedAt = DateTime.UtcNow
        };

        _context.LoginActivities.Add(activity);

        await _context.SaveChangesAsync();
    }


    public async Task CreateSessionAsync(
        Guid userId,
        string deviceName,
        string browser,
        string ipAddress,
        string country,
        string refreshTokenHash)
    {
        var session = new UserSession
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            DeviceName = deviceName,
            Browser = browser,
            IpAddress = ipAddress,
            Country = country,
            RefreshTokenHash = refreshTokenHash,
            IsActive = true,
            IsCurrent = true,
            CreatedAt = DateTime.UtcNow,
            LastActivityAt = DateTime.UtcNow
        };

        _context.UserSessions.Add(session);

        await _context.SaveChangesAsync();
    }


    public async Task<List<UserSession>> GetActiveSessionsAsync(Guid userId)
    {
        return await _context.UserSessions
            .Where(x =>
                x.UserId == userId &&
                x.IsActive)
            .OrderByDescending(x => x.LastActivityAt)
            .ToListAsync();
    }


    public async Task RevokeSessionAsync(
        Guid sessionId,
        Guid userId)
    {
        var session =
            await _context.UserSessions
            .FirstOrDefaultAsync(x =>
                x.Id == sessionId &&
                x.UserId == userId);


        if (session == null)
        {
            return;
        }


        session.IsActive = false;
        session.IsCurrent = false;
        session.RevokedAt = DateTime.UtcNow;


        await _context.SaveChangesAsync();
    }


    public async Task<List<LoginActivity>> GetLoginActivitiesAsync(
        Guid userId)
    {
        return await _context.LoginActivities
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(50)
            .ToListAsync();
    }
}
