using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AumoFinance.Models;
using AumoFinance.Models.DTOs;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace AumoFinance.Controllers.Api;

[ApiController]
[Route("api/mobile/auth")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        AppDbContext db,
        IConfiguration configuration)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _db = db;
        _configuration = configuration;
    }

    // ==========================================
    // 1. POST: /api/mobile/auth/login
    // ==========================================
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] MobileLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new MobileLoginResponse { Success = false, Message = "Email and password are required." });
        }

        var user = await _userManager.FindByEmailAsync(request.Email)
                   ?? await _userManager.FindByNameAsync(request.Email);

        if (user == null)
        {
            return Unauthorized(new MobileLoginResponse { Success = false, Message = "Invalid email/username or password." });
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: false);
        if (!result.Succeeded)
        {
            return Unauthorized(new MobileLoginResponse { Success = false, Message = "Invalid email/username or password." });
        }

        // Generate JWT Token
        // IMPORTANT: signing key/issuer must resolve exactly the same way as the
        // validation side configured in Program.cs (JWT_SIGNING_KEY / JWT_ISSUER),
        // otherwise every subsequent request fails signature validation (401).
        var jwtSigningKey = _configuration["JWT_SIGNING_KEY"]
            ?? Environment.GetEnvironmentVariable("JWT_SIGNING_KEY");

        var jwtIssuer = _configuration["JWT_ISSUER"]
            ?? Environment.GetEnvironmentVariable("JWT_ISSUER")
            ?? "AumoFinanceApp";

        if (string.IsNullOrWhiteSpace(jwtSigningKey))
        {
            return StatusCode(500, new MobileLoginResponse { Success = false, Message = "Server misconfiguration: JWT signing key is missing." });
        }

        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(jwtSigningKey);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email ?? ""),
                new Claim(ClaimTypes.Name, user.UserName ?? "")
            }),
            Expires = DateTime.UtcNow.AddDays(30),
            Issuer = jwtIssuer,
            Audience = jwtIssuer,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        // Record User Session
        var session = new AumoFinance.Models.Security.UserSession
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            RefreshTokenHash = tokenString.Substring(0, Math.Min(250, tokenString.Length)),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "0.0.0.0",
            UserAgent = Request.Headers["User-Agent"].ToString() ?? "AumoMobileApp",
            DeviceName = "Mobile Device",
            OperatingSystem = "Android/iOS",
            Browser = "Mobile Native",
            Country = "ID",
            IsActive = true,
            IsCurrent = true,
            CreatedAt = DateTime.UtcNow,
            LastActivityAt = DateTime.UtcNow
        };
        _db.UserSessions.Add(session);
        await _db.SaveChangesAsync();

        return Ok(new MobileLoginResponse
        {
            Success = true,
            Message = "Login successful.",
            Token = tokenString,
            UserId = user.Id.ToString(),
            FullName = user.FullName ?? user.UserName ?? "User"
        });
    }

    // ==========================================
    // 2. GET: /api/mobile/auth/me (Get Current Profile)
    // ==========================================
    [HttpGet("me")]
    public async Task<IActionResult> GetProfile()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out Guid userId)) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null) return NotFound(new { success = false, message = "User not found." });

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
    // 3. POST: /api/mobile/auth/logout
    // ==========================================
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        // JWT is stateless on client side, returning success response
        return Ok(new { success = true, message = "Logged out successfully." });
    }
}
