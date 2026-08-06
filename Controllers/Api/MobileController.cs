using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AumoFinance.Models;
using AumoFinance.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace AumoFinance.Controllers.Api;

[ApiController]
[Route("api/mobile")]
public class MobileController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly AppDbContext _context;

    // Hardcoded Secret Key untuk penandatanganan JWT (Minimal 32 karakter/256-bit)
    public static readonly string JwtSecretKey = "AumoFinance_Mobile_Secure_JWT_Secret_Key_2026_998877665544332211";
    public static readonly string JwtIssuer = "AumoFinanceWeb";

    public MobileController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        AppDbContext context)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _context = context;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] MobileLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new MobileLoginResponse { Success = false, Message = "Email dan password wajib diisi." });
        }

        var user = await _userManager.FindByEmailAsync(request.Email) 
                   ?? await _userManager.FindByNameAsync(request.Email);

        if (user == null)
        {
            return Unauthorized(new MobileLoginResponse { Success = false, Message = "Email/Username atau password salah." });
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: false);
        if (!result.Succeeded)
        {
            return Unauthorized(new MobileLoginResponse { Success = false, Message = "Email/Username atau password salah." });
        }

        // Generate JWT Token
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(JwtSecretKey);
        
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email ?? ""),
                new Claim(ClaimTypes.Name, user.UserName ?? "")
            }),
            Expires = DateTime.UtcNow.AddDays(30), // Token berlaku 30 hari
            Issuer = JwtIssuer,
            Audience = JwtIssuer,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        // Record User Session jika diperlukan
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
        _context.UserSessions.Add(session);
        await _context.SaveChangesAsync();

        return Ok(new MobileLoginResponse
        {
            Success = true,
            Message = "Login berhasil.",
            Token = tokenString,
            UserId = user.Id.ToString(),
            FullName = user.FullName ?? user.UserName ?? "User"
        });
    }

    [HttpGet("accounts")]
    [Authorize]
    public async Task<IActionResult> GetAccounts()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out Guid userId))
        {
            return Unauthorized();
        }

        var accounts = await _context.ChartOfAccounts
            .Where(x => x.UserId == userId && x.IsActive)
            .OrderBy(x => x.ReferenceNumber)
            .Select(x => new AccountDto
            {
                Id = x.Id,
                ReferenceNumber = x.ReferenceNumber,
                AccountName = x.AccountName,
                Type = x.Type,
                Role = x.Role
            })
            .ToListAsync();

        return Ok(accounts);
    }

    [HttpPost("journal-entries")]
    [Authorize]
    public async Task<IActionResult> CreateJournalEntry([FromBody] CreateJournalEntryRequest request)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out Guid userId))
        {
            return Unauthorized();
        }

        if (request.Lines == null || !request.Lines.Any())
        {
            return BadRequest(new { message = "Jurnal harus memiliki minimal satu baris rincian." });
        }

        // Check Balance Debit & Credit
        decimal totalDebit = request.Lines.Sum(x => x.Debit);
        decimal totalCredit = request.Lines.Sum(x => x.Credit);

        if (totalDebit != totalCredit)
        {
            return BadRequest(new { message = $"Jurnal tidak seimbang. Total Debit: {totalDebit}, Total Kredit: {totalCredit}" });
        }

        // Auto Generate Nomor Referensi per User
        int lastRefNo = await _context.JournalEntries
            .Where(x => x.UserId == userId)
            .CountAsync();

        string refNumber = $"{request.JournalType}-{(lastRefNo + 1):D6}";

        var entry = new JournalEntry
        {
            UserId = userId,
            EntryDate = request.EntryDate.ToUniversalTime(),
            CreatedAt = DateTime.UtcNow,
            JournalType = request.JournalType,
            ReferenceNumber = refNumber,
            MobileNote = request.MobileNote,
            Source = "Mobile App",
            NeedsClassification = false,
            Lines = request.Lines.Select(l => new JournalEntryLine
            {
                AccountId = l.AccountId,
                Debit = l.Debit,
                Credit = l.Credit,
                LineDescription = l.LineDescription,
                LineOrder = l.LineOrder
            }).ToList()
        };

        _context.JournalEntries.Add(entry);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Jurnal berhasil disimpan.",
            journalId = entry.Id,
            referenceNumber = entry.ReferenceNumber
        });
    }
}
