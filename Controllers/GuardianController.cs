using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;
using AumoFinance.Services.Security;

namespace AumoFinance.Controllers;

public class GuardianController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppDbContext _context;
    private readonly IGuardianService _guardianService;

    public GuardianController(
        UserManager<ApplicationUser> userManager,
        AppDbContext context,
        IGuardianService guardianService)
    {
        _userManager = userManager;
        _context = context;
        _guardianService = guardianService;
    }

    // GET: /Guardian
    public async Task<IActionResult> Index()
    {
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Unauthorized();
        }

        var model = new GuardianViewModel
        {
            Sessions = await _guardianService.GetActiveSessionsAsync(user.Id),
            Activities = await _guardianService.GetLoginActivitiesAsync(user.Id)
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

        TempData["SuccessMessage"] = "Session has been signed out.";

        return RedirectToAction(nameof(Index));
    }

    // GET: /Guardian/ExportAuditLog
    public async Task<IActionResult> ExportAuditLog()
    {
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Unauthorized();
        }

        var activities = await _guardianService.GetLoginActivitiesAsync(user.Id);

        var sb = new StringBuilder();
        sb.AppendLine("ActivityType,Device,IpAddress,Country,IsSuccess,CreatedAt");

        foreach (var activity in activities)
        {
            sb.AppendLine(string.Join(",",
                Csv(activity.ActivityType),
                Csv(activity.Device),
                Csv(activity.IpAddress),
                Csv(activity.Country),
                activity.IsSuccess,
                activity.CreatedAt.ToString("u")));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"guardian-audit-log-{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    private static string Csv(string? value)
    {
        value ??= string.Empty;
        return value.Contains(',') || value.Contains('"')
            ? $"\"{value.Replace("\"", "\"\"")}\""
            : value;
    }

    // POST: /Guardian/RevokeAllSessions
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RevokeAllSessions()
    {
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Unauthorized();
        }

        // 1. Matikan seluruh session aktif di database
        var userSessions = await _context.UserSessions
            .Where(s => s.UserId == user.Id && s.IsActive)
            .ToListAsync();

        foreach (var session in userSessions)
        {
            session.IsActive = false;
            session.RevokedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        // 2. Kunci Utama: Perbarui Security Stamp agar cookie ASP.NET di semua browser hangus
        await _userManager.UpdateSecurityStampAsync(user);

        TempData["SuccessMessage"] = "All active sessions have been revoked. Please log in again.";

        // Redirect ke Login karena cookie milik pengguna saat ini juga otomatis hangus
        return RedirectToAction("Login", "Auth");
    }
}
