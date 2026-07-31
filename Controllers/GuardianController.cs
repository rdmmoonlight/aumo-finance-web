using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using AumoFinance.Models;
using AumoFinance.Services; // Sesuaikan namespace service Anda

namespace AumoFinance.Controllers;

public class GuardianController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IGuardianService _guardianService; // Sesuaikan nama service Anda

    public GuardianController(
        UserManager<ApplicationUser> userManager,
        IGuardianService guardianService)
    {
        _userManager = userManager;
        _guardianService = guardianService;
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

        // 1. Matikan seluruh record di DB
        await _guardianService.RevokeAllSessionsAsync(user.Id);

        // 2. Kunci Utama: Perbarui Security Stamp agar cookie ASP.NET di semua browser hangus!
        await _userManager.UpdateSecurityStampAsync(user);

        TempData["SuccessMessage"] = "All active sessions have been revoked. Please log in again.";

        // Redirect ke Login karena cookie milik pengguna saat ini juga otomatis hangus
        return RedirectToAction("Login", "Auth");
    }
}
