using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Data; // Sesuaikan jika AppDbContext berada di namespace AumoFinance.Models
using AumoFinance.Models;

namespace AumoFinance.Controllers;

public class GuardianController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppDbContext _context;

    public GuardianController(
        UserManager<ApplicationUser> userManager,
        AppDbContext context)
    {
        _userManager = userManager;
        _context = context;
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
