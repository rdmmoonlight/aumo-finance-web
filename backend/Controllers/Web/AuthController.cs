using AumoFinance.Models;
using AumoFinance.Models.DTOs;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Controllers.Web;

[ApiController]
[Route("web/auth")]
[Authorize(AuthenticationSchemes = CookieAuthenticationDefaults.AuthenticationScheme)]
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
    // 1. POST: /web/auth/login
    // ==========================================
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] WebLoginRequest request)
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

        // Melakukan Sign-in berbasis Cookie (IsPersistent sesuai dengan RememberMe)
        var result = await _signInManager.PasswordSignInAsync(
            user.UserName ?? user.Email!,
            request.Password,
            isPersistent: request.RememberMe,
            lockoutOnFailure: false);

        if (!result.Succeeded)
        {
            return Unauthorized(new { success = false, message = "Invalid email/username or password." });
        }

        // Catat Sesi Web User ke Database
        var session = new AumoFinance.Models.Security.UserSession
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            RefreshTokenHash = "WEB_COOKIE_SESSION",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "0.0.0.0",
            UserAgent = Request.Headers["User-Agent"].ToString() ?? "WebBrowser",
            DeviceName = "Web Client",
            OperatingSystem = "Desktop/Web",
            Browser = "Web Browser",
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
    // 2. GET: /web/auth/me (Current Web User Profile)
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
    // 3. POST: /web/auth/logout
    // ==========================================
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        // Menghapus session cookie pada browser
        await _signInManager.SignOutAsync();
        return Ok(new { success = true, message = "Logged out successfully." });
    }
}

// DTO khusus untuk Web Login
public class WebLoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool RememberMe { get; set; } = false;
}
