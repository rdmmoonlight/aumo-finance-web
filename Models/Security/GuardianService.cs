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



    public async Task<List<UserSession>> GetActiveSessionsAsync(Guid userId)
    {
        return await _context.UserSessions
            .Where(x =>
                x.UserId == userId &&
                x.IsActive)
            .OrderByDescending(x => x.LastActivityAt)
            .ToListAsync();
    }



    public async Task<List<LoginActivity>> GetLoginActivitiesAsync(Guid userId)
    {
        return await _context.LoginActivities
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(50)
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
        session.RevokedAt = DateTime.UtcNow;


        await _context.SaveChangesAsync();
    }



    public async Task CreateSessionAsync(
        UserSession session)
    {
        await _context.UserSessions.AddAsync(session);

        await _context.SaveChangesAsync();
    }



    public async Task CreateLoginActivityAsync(
        LoginActivity activity)
    {
        await _context.LoginActivities.AddAsync(activity);

        await _context.SaveChangesAsync();
    }
}
