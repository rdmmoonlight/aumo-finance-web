using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using AumoFinance.Models;
using AumoFinance.Services; // Tambahkan namespace Services Anda

namespace AumoFinance.Controllers;

public class GuardianController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly GuardianService _guardianService; // Tanpa huruf 'I' jika nama class-nya GuardianService

    public GuardianController(
        UserManager<ApplicationUser> userManager,
        GuardianService guardianService)
    {
        _userManager = userManager;
        _guardianService = guardianService;
    }

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

        return RedirectToAction("Login", "Auth");
    }
}
