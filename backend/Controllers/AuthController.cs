using AumoBackend.Models;
using AumoBackend.Models.DTOs;
using AumoBackend.Models.Guardian;
using AumoBackend.Services.Guardian;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace AumoBackend.Controllers;

[ApiController]
[Route("/api/v1/auth")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IGuardianService _guardianService;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IGuardianService guardianService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _guardianService = guardianService;
    }

    // ==========================================
    // 1. POST: /api/v1/auth/login
    // ==========================================
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { success = false, message = "Email and password are required." });
        }

        var user = await _userManager.FindByEmailAsync(request.Email)
                   ?? await _userManager.FindByNameAsync(request.Email);

        if (user == null)
        {
            return Unauthorized(new { success = false, message = "Invalid email/username or password." });
        }

        // Sign-in berbasis Cookie Identity
        var result = await _signInManager.PasswordSignInAsync(
            user.UserName ?? user.Email!,
            request.Password,
            isPersistent: request.RememberMe,
            lockoutOnFailure: false);

        // Prioritaskan UserAgent dari Body JSON Request (jika dikirim FE), lalu Header, lalu Fallback
        var headerUserAgent = Request.Headers["User-Agent"].ToString();
        var safeUserAgent = !string.IsNullOrWhiteSpace(request.UserAgent) 
            ? request.UserAgent 
            : (!string.IsNullOrWhiteSpace(headerUserAgent) ? headerUserAgent : "Aumo Client / Web");

        if (!result.Succeeded)
        {
            // Catat log login gagal
            var isMobileFail = safeUserAgent.Contains("Android", StringComparison.OrdinalIgnoreCase) ||
                               safeUserAgent.Contains("iPhone", StringComparison.OrdinalIgnoreCase) ||
                               safeUserAgent.Contains("Mobile", StringComparison.OrdinalIgnoreCase);

            string deviceCategoryFail = isMobileFail ? "Mobile" : "Web";

            await _guardianService.CreateLoginActivityAsync(
                user.Id,
                "Failed Login",
                deviceCategoryFail,
                isMobileFail ? "Mobile App/Browser" : "Web Browser",
                HttpContext.Connection.RemoteIpAddress?.ToString() ?? "0.0.0.0",
                "ID",
                false,
                operatingSystem: !string.IsNullOrWhiteSpace(request.OperatingSystem) ? request.OperatingSystem : deviceCategoryFail,
                userAgent: safeUserAgent // Terkirim eksplisit (Mencegah error NOT NULL UserAgent di LoginActivities)
            );

            return Unauthorized(new { success = false, message = "Invalid email/username or password." });
        }

        // Deteksi Perangkat: Mobile vs Web
        var isMobile = safeUserAgent.Contains("Android", StringComparison.OrdinalIgnoreCase) ||
                       safeUserAgent.Contains("iPhone", StringComparison.OrdinalIgnoreCase) ||
                       safeUserAgent.Contains("Mobile", StringComparison.OrdinalIgnoreCase);

        string deviceCategory = isMobile ? "Mobile" : "Web";
        string ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "0.0.0.0";
        string osValue = !string.IsNullOrWhiteSpace(request.OperatingSystem) ? request.OperatingSystem : deviceCategory;

        // 1. Buat Sesi Login Baru
        await _guardianService.CreateSessionAsync(
            user.Id,
            deviceName: deviceCategory,
            operatingSystem: osValue,
            browser: isMobile ? "Mobile App/Browser" : "Web Browser",
            ipAddress: ip,
            country: "ID",
            refreshTokenHash: "COOKIE_SESSION",
            userAgent: safeUserAgent
        );

        // 2. Catat Log Aktivitas Login Sukses
        await _guardianService.CreateLoginActivityAsync(
            user.Id,
            "Interactive Login",
            deviceCategory,
            isMobile ? "Mobile App/Browser" : "Web Browser",
            ip,
            "ID",
            true,
            operatingSystem: osValue,
            userAgent: safeUserAgent // Terkirim eksplisit (Mencegah error NOT NULL UserAgent di LoginActivities)
        );

        return Ok(new
        {
            success = true,
            message = "Login successful.",
            userId = user.Id.ToString(),
            fullName = user.FullName ?? user.UserName ?? "User"
        });
    }

    // ==========================================
    // 2. GET: /api/v1/auth/me
    // ==========================================
    [HttpGet("me")]
    public async Task<IActionResult> GetProfile()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null)
            return NotFound(new { success = false, message = "User session active, but user not found." });

        return Ok(new
        {
            success = true,
            userId = user.Id,
            email = user.Email,
            userName = user.UserName,
            fullName = user.FullName ?? user.UserName
        });
    }

    // ==========================================
    // 3. POST: /api/v1/auth/logout
    // ==========================================
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return Ok(new { success = true, message = "Logged out successfully." });
    }
}

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool RememberMe { get; set; } = false;
    public string? UserAgent { get; set; }
    public string? OperatingSystem { get; set; }
}
