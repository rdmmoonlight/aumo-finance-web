using System.Security.Claims;
using AumoFinance.Models.Guardian;
using AumoFinance.Services.Guardian;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers.Web;

[ApiController]
[Route("web/guardian")]
[Authorize]
public class GuardianController : ControllerBase
{
    private readonly IGuardianService _guardianService;

    public GuardianController(IGuardianService guardianService)
    {
        _guardianService = guardianService;
    }

    [HttpGet]
    public async Task<IActionResult> GetDashboardData()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized(new { success = false, message = "Unauthorized access." });
        }

        var sessions = await _guardianService.GetActiveSessionsAsync(userId);
        var activities = await _guardianService.GetLoginActivitiesAsync(userId);

        var viewModel = new GuardianDashboardViewModel
        {
            ActiveSessions = sessions.Count,
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

        return Ok(new { success = true, data = viewModel });
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
}
