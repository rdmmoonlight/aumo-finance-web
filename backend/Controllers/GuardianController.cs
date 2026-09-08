using System.Security.Claims;
using AumoBackend.Models;
using AumoBackend.Models.Guardian;
using AumoBackend.Services.Guardian;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace AumoBackend.Controllers.Web;

[ApiController]
[Route("api/v1/guardian")]
[Authorize]
public class GuardianController : ControllerBase
{
    private readonly IGuardianService _guardianService;
    private readonly UserManager<ApplicationUser> _userManager;

    public GuardianController(
        IGuardianService guardianService,
        UserManager<ApplicationUser> userManager)
    {
        _guardianService = guardianService;
        _userManager = userManager;
    }

    [HttpGet]
    public async Task<IActionResult> GetDashboardData()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized(new { success = false, message = "Unauthorized access." });
        }

        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            return NotFound(new { success = false, message = "User not found." });
        }

        var sessions = await _guardianService.GetActiveSessionsAsync(userId);
        var activities = await _guardianService.GetLoginActivitiesAsync(userId);

        var lastLoginActivity = activities.FirstOrDefault(a => a.IsSuccess);

        var viewModel = new GuardianDashboardViewModel
        {
            Username = user.UserName ?? string.Empty,
            Email = user.Email ?? string.Empty,
            SecurityScore = calculateSecurityScore(user),
            ActiveSessions = sessions.Count,
            TrustedDevices = sessions.Select(s => s.DeviceName).Distinct().Count(),
            LastLogin = lastLoginActivity?.CreatedAt ?? DateTime.UtcNow,
            Security = new SecurityStatusViewModel
            {
                EmailVerified = user.EmailConfirmed
            },
            RecentActivities = activities.Select(a => new LoginActivityViewModel
            {
                Activity = a.ActivityType,
                Device = a.Device,
                Browser = a.Browser,
                Country = a.Country,
                IpAddress = a.IpAddress,
                OccurredAt = a.CreatedAt
            }).ToList()
        };

        var mappedActiveSessions = sessions.Select(s => new ActiveSessionViewModel
        {
            DeviceName = s.DeviceName,
            Browser = s.Browser,
            IpAddress = s.IpAddress,
            Country = s.Country,
            LastActivity = s.LastActivityAt,
            IsCurrent = s.IsCurrent
        }).ToList();

        return Ok(new
        {
            success = true,
            data = viewModel,
            activeSessions = mappedActiveSessions
        });
    }

    [HttpPost("revoke-session/{sessionId:guid}")]
    public async Task<IActionResult> RevokeSession(Guid sessionId)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized(new { success = false, message = "Unauthorized access." });
        }

        await _guardianService.RevokeSessionAsync(sessionId, userId);
        return Ok(new { success = true, message = "Session revoked successfully." });
    }

    [HttpPost("revoke-all")]
    public async Task<IActionResult> RevokeAllSessions()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized(new { success = false, message = "Unauthorized access." });
        }

        await _guardianService.RevokeAllSessionsAsync(userId);
        return Ok(new { success = true, message = "All other sessions revoked successfully." });
    }

    private static int calculateSecurityScore(ApplicationUser user)
    {
        return user.EmailConfirmed ? 100 : 50;
    }
}
