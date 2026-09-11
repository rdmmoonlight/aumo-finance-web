using AumoBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace AumoBackend.Controllers
{
    [ApiController]
    [Route("/api/v1/guardian")]
    [Authorize(AuthenticationSchemes = "Identity.Application,Bearer")]
    public class GuardianController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IGuardianService _guardianService;

        public GuardianController(
            UserManager<ApplicationUser> userManager,
            IGuardianService guardianService)
        {
            _userManager = userManager;
            _guardianService = guardianService;
        }

        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboard()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
                return Unauthorized(new { success = false, message = "User not authenticated." });

            var activeSessions = await _guardianService.GetActiveSessionsAsync(user.Id);
            var loginActivities = await _guardianService.GetLoginActivitiesAsync(user.Id);

            var failedAttempts = loginActivities.Count(a => !a.IsSuccess && a.CreatedAt >= DateTime.UtcNow.AddDays(-1));
            var lastSuccess = loginActivities.FirstOrDefault(a => a.IsSuccess)?.CreatedAt;

            var dashboard = new GuardianDashboardViewModel
            {
                SecurityStatus = new SecurityStatusViewModel
                {
                    StatusLevel = failedAttempts > 3 ? "Warning" : "Good",
                    ActiveSessionsCount = activeSessions.Count,
                    FailedAttemptsLast24Hours = failedAttempts,
                    LastSuccessfulLogin = lastSuccess
                },
                RecentActivities = loginActivities.Select(a => new LoginActivityViewModel
                {
                    Id = a.Id,
                    ActivityType = a.ActivityType,
                    Device = a.Device,
                    OperatingSystem = a.OperatingSystem,
                    Browser = a.Browser,
                    IpAddress = a.IpAddress,
                    Country = a.Country,
                    IsSuccess = a.IsSuccess,
                    CreatedAt = a.CreatedAt
                }).ToList(),
                ActiveSessions = activeSessions.Select(s => new ActiveSessionViewModel
                {
                    Id = s.Id,
                    DeviceName = s.DeviceName,
                    OperatingSystem = s.OperatingSystem,
                    Browser = s.Browser,
                    IpAddress = s.IpAddress,
                    Country = s.Country,
                    IsCurrent = s.IsCurrent,
                    LastActivityAt = s.LastActivityAt
                }).ToList()
            };

            return Ok(new { success = true, data = dashboard });
        }

        [HttpPost("revoke-session/{sessionId}")]
        public async Task<IActionResult> RevokeSession(Guid sessionId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
                return Unauthorized(new { success = false, message = "User not authenticated." });

            await _guardianService.RevokeSessionAsync(sessionId, user.Id);
            return Ok(new { success = true, message = "Session revoked successfully." });
        }

        [HttpPost("revoke-all-sessions")]
        public async Task<IActionResult> RevokeAllSessions()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
                return Unauthorized(new { success = false, message = "User not authenticated." });

            await _guardianService.RevokeAllSessionsAsync(user.Id);
            return Ok(new { success = true, message = "All other sessions revoked successfully." });
        }
    }
}
