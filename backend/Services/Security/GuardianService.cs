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
        // 1. Ambil semua sesi aktif milik user, urutkan dari yang terbaru
        var activeSessions = await _context.UserSessions
            .Where(x => x.UserId == userId && x.IsActive)
            .OrderByDescending(x => x.LastActivityAt)
            .ToListAsync();

        // 2. Batasi hanya 4 sesi teratas yang dipertahankan. 
        // Sesi ke-5 ke bawah (yang paling lama) akan otomatis di-revoke agar 
        // saat sesi baru ditambahkan, totalnya pas menjadi maksimal 5 sesi aktif.
        var sessionsToKeep = activeSessions.Take(4).ToList();
        var sessionsToRevoke = activeSessions.Skip(4).ToList();

        foreach (var oldSession in sessionsToRevoke)
        {
            oldSession.IsActive = false;
            oldSession.IsCurrent = false;
            oldSession.RevokedAt = DateTime.UtcNow;
        }

        // 3. Pastikan semua sesi aktif yang tersisa di-set IsCurrent = false 
        // karena sesi saat ini yang baru akan menjadi 'current'.
        foreach (var session in activeSessions)
        {
            session.IsCurrent = false;
        }

        // 4. Buat sesi baru
        var newSession = new UserSession
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

        _context.UserSessions.Add(newSession);

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

    public async Task RevokeAllSessionsAsync(Guid userId)
    {
        var activeSessions = await _context.UserSessions
            .Where(x => x.UserId == userId && x.IsActive)
            .ToListAsync();

        if (!activeSessions.Any())
        {
            return;
        }

        foreach (var session in activeSessions)
        {
            session.IsActive = false;
            session.IsCurrent = false;
            session.RevokedAt = DateTime.UtcNow;
        }

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
