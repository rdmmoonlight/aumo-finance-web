using AumoBackend.Models;
using AumoBackend.Models.DTOs;
using AumoBackend.Models.Guardian;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoBackend.Controllers;

[ApiController]
[Route("/api/v1/auth")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly AppDbContext _db;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        AppDbContext db)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _db = db;
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

        // Sign-in berbasis Cookie Identity (IsPersistent sesuai dengan RememberMe)
        var result = await _signInManager.PasswordSignInAsync(
            user.UserName ?? user.Email!,
            request.Password,
            isPersistent: request.RememberMe,
            lockoutOnFailure: false);

        if (!result.Succeeded)
        {
            return Unauthorized(new { success = false, message = "Invalid email/username or password." });
        }

        // Deteksi apakah akses dari Mobile atau Web
        var userAgent = Request.Headers["User-Agent"].ToString();
        var isMobile = !string.IsNullOrEmpty(userAgent) && 
                       (userAgent.Contains("Android", StringComparison.OrdinalIgnoreCase) ||
                        userAgent.Contains("iPhone", StringComparison.OrdinalIgnoreCase) ||
                        userAgent.Contains("Mobile", StringComparison.OrdinalIgnoreCase));

        string deviceType = isMobile ? "Mobile" : "Web";

        // Catat Sesi User ke Database
        var session = new UserSession
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            RefreshTokenHash = "COOKIE_SESSION",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "0.0.0.0",
            OperatingSystem = deviceType, // Diisi "Web" atau "Mobile" (Dijamin NOT NULL)
            DeviceName = deviceType,
            Browser = isMobile ? "Mobile App/Browser" : "Web Browser",
            Country = "ID",
            IsActive = true,
            IsCurrent = true,
            CreatedAt = DateTime.UtcNow,
            LastActivityAt = DateTime.UtcNow
        };
        _db.UserSessions.Add(session);
        await _db.SaveChangesAsync();

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
        // Menghapus session cookie
        await _signInManager.SignOutAsync();
        return Ok(new { success = true, message = "Logged out successfully." });
    }
}

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool RememberMe { get; set; } = false;
}
