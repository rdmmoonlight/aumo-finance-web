using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AumoBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace AumoBackend.Controllers;

[ApiController]
[Route("/api/v1/auth")]
// Menerima cookie ASP.NET Identity (web/nextjs) MAUPUN JWT Bearer (mobile) —
// dua-duanya sudah dikonfigurasi di Program.cs (DefaultPolicy malah sudah
// menerima keduanya lewat AddAuthenticationSchemes), controller lain di
// project ini sebelumnya cuma sengaja dipersempit ke cookie saja lewat
// atribut ini. Login tetap sign-in cookie seperti biasa (SignInManager,
// dipakai web/nextjs) DAN sekaligus menerbitkan token JWT di response body
// (dipakai mobile) — dua mekanisme berjalan berdampingan, tidak saling
// menggantikan.
[Authorize(AuthenticationSchemes = "Identity.Application,Bearer")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IGuardianService _guardianService;
    private readonly IConfiguration _configuration;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IGuardianService guardianService,
        IConfiguration configuration)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _guardianService = guardianService;
        _configuration = configuration;
    }

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

        var result = await _signInManager.PasswordSignInAsync(
            user.UserName ?? user.Email!,
            request.Password,
            isPersistent: request.RememberMe,
            lockoutOnFailure: false);

        var headerUserAgent = Request.Headers["User-Agent"].ToString();
        var safeUserAgent = !string.IsNullOrWhiteSpace(request.UserAgent)
            ? request.UserAgent
            : (!string.IsNullOrWhiteSpace(headerUserAgent) ? headerUserAgent : "Aumo Client / Web");

        if (!result.Succeeded)
        {
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
                userAgent: safeUserAgent
            );

            return Unauthorized(new { success = false, message = "Invalid email/username or password." });
        }

        var isMobile = safeUserAgent.Contains("Android", StringComparison.OrdinalIgnoreCase) ||
                       safeUserAgent.Contains("iPhone", StringComparison.OrdinalIgnoreCase) ||
                       safeUserAgent.Contains("Mobile", StringComparison.OrdinalIgnoreCase);

        string deviceCategory = isMobile ? "Mobile" : "Web";
        string ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "0.0.0.0";
        string osValue = !string.IsNullOrWhiteSpace(request.OperatingSystem) ? request.OperatingSystem : deviceCategory;

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

        await _guardianService.CreateLoginActivityAsync(
            user.Id,
            "Interactive Login",
            deviceCategory,
            isMobile ? "Mobile App/Browser" : "Web Browser",
            ip,
            "ID",
            true,
            operatingSystem: osValue,
            userAgent: safeUserAgent
        );

        return Ok(new
        {
            success = true,
            message = "Login successful.",
            userId = user.Id.ToString(),
            fullName = user.FullName ?? user.UserName ?? "User",
            token = GenerateJwtToken(user)
        });
    }

    // Dipakai mobile lewat header "Authorization: Bearer <token>". Signing
    // key/issuer sama persis dengan yang dipakai Program.cs memvalidasi JWT
    // (JWT_SIGNING_KEY/JWT_ISSUER) supaya token yang diterbitkan di sini
    // memang lolos TokenValidationParameters yang sudah dikonfigurasi.
    // ClaimTypes.NameIdentifier dipakai karena controller lain di project
    // ini sudah lebih dulu membaca User.FindFirstValue(ClaimTypes.
    // NameIdentifier) (dengan fallback "sub") untuk menentukan user yang
    // sedang login — token ini otomatis kompatibel tanpa controller lain
    // perlu diubah.
    private string GenerateJwtToken(ApplicationUser user)
    {
        var jwtSigningKey = _configuration["JWT_SIGNING_KEY"]
            ?? Environment.GetEnvironmentVariable("JWT_SIGNING_KEY")
            ?? throw new InvalidOperationException("JWT_SIGNING_KEY is missing.");

        var jwtIssuer = _configuration["JWT_ISSUER"]
            ?? Environment.GetEnvironmentVariable("JWT_ISSUER")
            ?? "AumoFinanceApp";

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.FullName ?? user.UserName ?? string.Empty),
            new Claim(ClaimTypes.Email, user.Email ?? string.Empty),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtIssuer,
            claims: claims,
            // 30 hari, disamakan dengan masa berlaku cookie sesi
            // (ConfigureApplicationCookie di Program.cs) supaya perilaku
            // "Ingat saya" konsisten antara web dan mobile.
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

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
