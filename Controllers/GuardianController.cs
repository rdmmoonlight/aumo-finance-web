using System.Text;
using AumoFinance.Models;
using AumoFinance.Services.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers;

[Authorize]
public class GuardianController : Controller
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

    // GET: /Guardian
    public async Task<IActionResult> Index()
    {
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return RedirectToAction("Login", "Auth");
        }

        var sessions = await _guardianService.GetActiveSessionsAsync(user.Id);
        var activities = await _guardianService.GetLoginActivitiesAsync(user.Id);

        var model = new GuardianViewModel
        {
            Sessions = sessions,
            Activities = activities
        };

        return View(model);
    }

    // POST: /Guardian/RevokeSession
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RevokeSession(Guid id)
    {
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Unauthorized();
        }

        await _guardianService.RevokeSessionAsync(id, user.Id);

        TempData["SuccessMessage"] = "Device session has been signed out.";

        return RedirectToAction(nameof(Index));
    }

    // POST: /Guardian/RevokeAllSessions (Emergency Kill Switch)
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RevokeAllSessions()
    {
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Unauthorized();
        }

        // Call service method to revoke all active sessions for this user
        await _guardianService.RevokeAllSessionsAsync(user.Id);

        TempData["SuccessMessage"] = "All active sessions have been signed out successfully.";

        return RedirectToAction(nameof(Index));
    }

    // GET: /Guardian/ExportAuditLog
    [HttpGet]
    public async Task<IActionResult> ExportAuditLog()
    {
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Unauthorized();
        }

        var activities = await _guardianService.GetLoginActivitiesAsync(user.Id);

        // Build CSV content
        var csvBuilder = new StringBuilder();
        csvBuilder.AppendLine("Activity,Device,IP Address,Status,Date");

        foreach (var activity in activities)
        {
            var status = activity.IsSuccess ? "Success" : "Failed";
            csvBuilder.AppendLine($"\"{activity.ActivityType}\",\"{activity.Device}\",\"{activity.IpAddress}\",\"{status}\",\"{activity.CreatedAt}\"");
        }

        var bytes = Encoding.UTF8.GetBytes(csvBuilder.ToString());
        var fileName = $"security-audit-log-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv";

        return File(bytes, "text/csv", fileName);
    }
}
