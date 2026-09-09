using AumoBackend.Models;
using AumoBackend.Models.Guardian;
using Microsoft.EntityFrameworkCore;

namespace AumoBackend.Services.Guardian
{
    public interface IGuardianService
    {
        Task CreateLoginActivityAsync(
            Guid userId,
            string activityType,
            string device,
            string browser,
            string ipAddress,
            string country,
            bool isSuccess,
            string operatingSystem = "Web",
            string userAgent = "Web"
        );

        Task CreateSessionAsync(
            Guid userId,
            string deviceName,
            string operatingSystem,
            string browser,
            string ipAddress,
            string country,
            string refreshTokenHash,
            string userAgent = "Web"
        );

        Task<List<UserSession>> GetActiveSessionsAsync(Guid userId);
        Task RevokeSessionAsync(Guid sessionId, Guid userId);
        Task RevokeAllSessionsAsync(Guid userId);
        Task<List<LoginActivity>> GetLoginActivitiesAsync(Guid userId);
    }

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
            bool isSuccess,
            string operatingSystem = "Web",
            string userAgent = "Web")
        {
            var activity = new LoginActivity
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                ActivityType = activityType,
                Device = string.IsNullOrWhiteSpace(device) ? "Web" : device,
                OperatingSystem = string.IsNullOrWhiteSpace(operatingSystem) ? "Web" : operatingSystem,
                UserAgent = string.IsNullOrWhiteSpace(userAgent) ? "Web" : userAgent,
                Browser = string.IsNullOrWhiteSpace(browser) ? "Browser" : browser,
                IpAddress = string.IsNullOrWhiteSpace(ipAddress) ? "0.0.0.0" : ipAddress,
                Country = string.IsNullOrWhiteSpace(country) ? "ID" : country,
                IsSuccess = isSuccess,
                CreatedAt = DateTime.UtcNow
            };

            _context.LoginActivities.Add(activity);
            await _context.SaveChangesAsync();
        }

        public async Task CreateSessionAsync(
            Guid userId,
            string deviceName,
            string operatingSystem,
            string browser,
            string ipAddress,
            string country,
            string refreshTokenHash,
            string userAgent = "Web")
        {
            var activeSessions = await _context.UserSessions
                .Where(x => x.UserId == userId && x.IsActive)
                .OrderByDescending(x => x.LastActivityAt)
                .ToListAsync();

            var sessionsToRevoke = activeSessions.Skip(4).ToList();

            foreach (var oldSession in sessionsToRevoke)
            {
                oldSession.IsActive = false;
                oldSession.IsCurrent = false;
                oldSession.RevokedAt = DateTime.UtcNow;
            }

            foreach (var session in activeSessions)
            {
                session.IsCurrent = false;
            }

            var newSession = new UserSession
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                DeviceName = string.IsNullOrWhiteSpace(deviceName) ? "Web" : deviceName,
                OperatingSystem = string.IsNullOrWhiteSpace(operatingSystem) ? "Web" : operatingSystem,
                Browser = string.IsNullOrWhiteSpace(browser) ? "Browser" : browser,
                UserAgent = string.IsNullOrWhiteSpace(userAgent) ? "Web" : userAgent,
                IpAddress = string.IsNullOrWhiteSpace(ipAddress) ? "0.0.0.0" : ipAddress,
                Country = string.IsNullOrWhiteSpace(country) ? "ID" : country,
                RefreshTokenHash = string.IsNullOrWhiteSpace(refreshTokenHash) ? "COOKIE_SESSION" : refreshTokenHash,
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
                .Where(x => x.UserId == userId && x.IsActive)
                .OrderByDescending(x => x.LastActivityAt)
                .ToListAsync();
        }

        public async Task RevokeSessionAsync(Guid sessionId, Guid userId)
        {
            var session = await _context.UserSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.UserId == userId);

            if (session == null) return;

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

            if (!activeSessions.Any()) return;

            foreach (var session in activeSessions)
            {
                session.IsActive = false;
                session.IsCurrent = false;
                session.RevokedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }

        public async Task<List<LoginActivity>> GetLoginActivitiesAsync(Guid userId)
        {
            return await _context.LoginActivities
                .Where(x => x.UserId == userId)
                .OrderByDescending(x => x.CreatedAt)
                .Take(50)
                .ToListAsync();
        }
    }
}
