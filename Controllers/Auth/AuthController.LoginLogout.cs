using AumoFinance.Models;
using AumoFinance.Models.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers;

public partial class AuthController
{
    // ============================
    // LOGIN
    // ============================

    [HttpGet]
    [AllowAnonymous]
    public IActionResult Login()
    {
        return View(new LoginViewModel());
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var user = await _userManager.FindByEmailAsync(model.Email);

        if (user == null)
        {
            ModelState.AddModelError(string.Empty, "Invalid email or password.");
            return View(model);
        }

        var result = await _signInManager.PasswordSignInAsync(
            user.UserName!,
            model.Password,
            isPersistent: true,
            lockoutOnFailure: true
        );

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
        var userAgent = Request.Headers.UserAgent.ToString();

        if (result.Succeeded)
        {
            await _guardianService.CreateLoginActivityAsync(
                user.Id,
                "Login Success",
                userAgent,
                userAgent,
                ipAddress,
                "",
                true
            );

            await _guardianService.CreateSessionAsync(
                user.Id,
                userAgent,
                userAgent,
                ipAddress,
                "",
                Guid.NewGuid().ToString()
            );

            return RedirectToAction("Index", "Home");
        }

        await _guardianService.CreateLoginActivityAsync(
            user.Id,
            "Login Failed",
            userAgent,
            userAgent,
            ipAddress,
            "",
            false
        );

        if (result.IsNotAllowed)
        {
            ModelState.AddModelError(string.Empty, "Please verify your email address before logging in.");
        }
        else if (result.IsLockedOut)
        {
            ModelState.AddModelError(string.Empty, "This account is temporarily locked out due to too many failed attempts.");
        }
        else
        {
            ModelState.AddModelError(string.Empty, "Invalid email or password.");
        }

        return View(model);
    }

    // ============================
    // LOGOUT
    // ============================

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var user = await _userManager.GetUserAsync(User);

        if (user != null)
        {
            var sessions = await _guardianService.GetActiveSessionsAsync(user.Id);
            var currentSession = sessions.FirstOrDefault(x => x.IsCurrent);

            if (currentSession != null)
            {
                await _guardianService.RevokeSessionAsync(currentSession.Id, user.Id);
            }
        }

        await _signInManager.SignOutAsync();

        return RedirectToAction("Login", "Auth");
    }
}
