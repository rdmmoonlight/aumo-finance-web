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
            return Unauthorized();

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
}
