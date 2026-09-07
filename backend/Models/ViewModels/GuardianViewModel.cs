using Microsoft.EntityFrameworkCore;
using AumoFinance.Data; // Lokasi AppDbContext
using AumoFinance.Models; // Lokasi AppDbContext alternatif jika ada di root Models

// =========================================================================
// 1. BACKWARD COMPATIBILITY ALIAS (Kompatibilitas Namespace Lama)
// Memastikan folder 'Security' bisa dihapus tanpa merusak file lain / EF Core.
// =========================================================================

namespace AumoFinance.Models.Security
{
    // Alias type memastikan C# memperlakukan tipe data ini identik 100%
    using UserSession = AumoFinance.Models.Guardian.UserSession;
    using LoginActivity = AumoFinance.Models.Guardian.LoginActivity;
}

namespace AumoFinance.Services.Security
{
    public interface IGuardianService : AumoFinance.Services.Guardian.IGuardianService { }
    
    public class GuardianService : AumoFinance.Services.Guardian.GuardianService, IGuardianService
    {
        public GuardianService(AppDbContext context) : base(context) { }
    }
}

// =========================================================================
// 2. NAMESPACE UTAMA (AumoFinance.Models.Guardian)
// =========================================================================

namespace AumoFinance.Models.Guardian
{
    #region View Models

    public class GuardianViewModel
    {
        public List<UserSession> Sessions { get; set; } = new();
        public List<LoginActivity> Activities { get; set; } = new();
    }

    public class GuardianDashboardViewModel
    {
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public int SecurityScore { get; set; }
        public int ActiveSessions { get; set; }
        public int TrustedDevices { get; set; }
        public DateTime LastLogin { get; set; }

        public SecurityStatusViewModel Security { get; set; } = new();
        public List<LoginActivityViewModel> RecentActivities { get; set; } = new();
    }

    public class ActiveSessionViewModel
    {
        public string DeviceName { get; set; } = string.Empty;
        public string Browser { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;
        public DateTime LastActivity { get; set; }
        public bool IsCurrent { get; set; }
    }

    public class LoginActivityViewModel
    {
        public string Activity { get; set; } = string.Empty;
        public string Device { get; set; } = string.Empty;
        public string Browser { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public DateTime OccurredAt { get; set; }
    }

    public class SecurityStatusViewModel
    {
        public bool EmailVerified { get; set; }
        public bool PasswordProtected { get; set; }
        public bool MultiFactorEnabled { get; set; }
        public bool RecoveryCodesAvailable { get; set; }
    }

    public class TrustedDeviceViewModel
    {
        public string Name { get; set; } = string.Empty;
        public string Browser { get; set; } = string.Empty;
        public DateTime AddedOn { get; set; }
    }

    #endregion

    #region Entities

    public class UserSession
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string DeviceName { get; set; } = string.Empty;
        public string Browser { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;
        public string RefreshTokenHash { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public bool IsCurrent { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime LastActivityAt { get; set; }
        public DateTime? RevokedAt { get; set; }
    }

    public class LoginActivity
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string ActivityType { get; set; } = string.Empty;
        public string Device { get; set; } = string.Empty;
        public string Browser { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;
        public bool IsSuccess { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    #endregion
}

// =========================================================================
// 3. SERVICE UTAMA (AumoFinance.Services.Guardian)
// =========================================================================

namespace AumoFinance.Services.Guardian
{
    using AumoFinance.Models.Guardian;

    #region Service Interface & Implementation

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

    #endregion
}
