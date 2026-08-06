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
using Microsoft.IdentityModel.Tokens;

namespace AumoFinance.Controllers.Api;

[ApiController]
[Route("api/mobile")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class MobileController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly AppDbContext _db;

    // Hardcoded Secret Key untuk penandatanganan JWT
    public static readonly string JwtSecretKey = "AumoFinance_Mobile_Secure_JWT_Secret_Key_2026_998877665544332211";
    public static readonly string JwtIssuer = "AumoFinanceWeb";

    public MobileController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        AppDbContext db)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _db = db;
    }

    // ==========================================
    // 1. POST: /api/mobile/login
    // ==========================================
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
            Expires = DateTime.UtcNow.AddDays(30),
            Issuer = JwtIssuer,
            Audience = JwtIssuer,
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
            Message = "Login berhasil.",
            Token = tokenString,
            UserId = user.Id.ToString(),
            FullName = user.FullName ?? user.UserName ?? "User"
        });
    }

    // ==========================================
    // 2. GET: /api/mobile/accounts
    // ==========================================
    [HttpGet("accounts")]
    public async Task<IActionResult> GetAccounts()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var accounts = await _db.ChartOfAccounts
            .Where(a => a.IsActive && a.UserId == userId)
            .OrderBy(a => a.ReferenceNumber)
            .Select(a => new AccountDto
            {
                Id = a.Id,
                ReferenceNumber = a.ReferenceNumber,
                AccountName = a.AccountName,
                Type = a.Type,
                Role = a.Role
            })
            .ToListAsync();

        return Ok(accounts);
    }

    // ==========================================
    // 3. POST: /api/mobile/journal-entries
    // ==========================================
    [HttpPost("journal-entries")]
    public async Task<IActionResult> CreateJournalEntry([FromBody] CreateJournalEntryRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        // A. Filter baris kosong (sama persis dengan Controller Web)
        var validLines = request.Lines
            .Where(l => l.AccountId != 0 && (l.Debit != 0 || l.Credit != 0))
            .ToList();

        if (validLines.Count < 2)
        {
            return BadRequest(new { message = "Jurnal harus memiliki minimal 2 baris rincian (line items)." });
        }

        // B. Validasi Total Debit == Total Kredit & Total > 0
        var totalDebit = validLines.Sum(l => l.Debit);
        var totalCredit = validLines.Sum(l => l.Credit);

        if (totalDebit != totalCredit || totalDebit == 0)
        {
            return BadRequest(new { message = "Total debit harus sama dengan total kredit dan tidak boleh nol." });
        }

        // C. Validasi Kepemilikan Akun (Akun harus milik user yang login)
        var validAccountIds = (await _db.ChartOfAccounts
            .Where(a => a.IsActive && a.UserId == userId)
            .Select(a => a.Id)
            .ToListAsync())
            .ToHashSet();

        if (validLines.Any(l => !validAccountIds.Contains(l.AccountId)))
        {
            return BadRequest(new { message = "Satu atau lebih akun yang dipilih tidak valid atau tidak aktif." });
        }

        // D. Validasi Kunci Periode (PeriodLock)
        var closedPeriods = await _db.Periods
            .Where(p => p.UserId == userId && p.IsClosed)
            .ToListAsync();

        if (PeriodLock.IsDateLocked(request.EntryDate, closedPeriods))
        {
            return BadRequest(new { message = "Tanggal transaksi berada pada periode yang sudah ditutup." });
        }

        // E. Generate Nomor Referensi Otomatis (GJ-xxxxxx / AJE-xxxxxx)
        string refNumber = await GenerateReferenceNumberAsync(userId, request.JournalType);

        // F. Simpan Jurnal Baru
        var entry = new JournalEntry
        {
            UserId = userId,
            ReferenceNumber = refNumber,
            JournalType = string.IsNullOrWhiteSpace(request.JournalType) ? "General" : request.JournalType,
            EntryDate = DateTime.SpecifyKind(request.EntryDate, DateTimeKind.Utc),
            CreatedAt = DateTime.UtcNow,
            Source = "Mobile App",
            MobileNote = request.MobileNote,
            NeedsClassification = false,
            Lines = validLines.Select((l, index) => new JournalEntryLine
            {
                AccountId = l.AccountId,
                LineDescription = l.LineDescription,
                Debit = l.Debit,
                Credit = l.Credit,
                LineOrder = index
            }).ToList()
        };

        _db.JournalEntries.Add(entry);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"Jurnal {entry.ReferenceNumber} berhasil disimpan.",
            journalId = entry.Id,
            referenceNumber = entry.ReferenceNumber
        });
    }

    // ==========================================
    // 4. GET: /api/mobile/search-descriptions?q=xxx
    // ==========================================
    [HttpGet("search-descriptions")]
    public async Task<IActionResult> SearchDescriptions([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
        {
            return Ok(Array.Empty<string>());
        }

        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var keyword = q.Trim();

        var results = await _db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry!.UserId == userId
                     && l.LineDescription != null && l.LineDescription != ""
                     && EF.Functions.ILike(l.LineDescription, $"%{keyword}%"))
            .GroupBy(l => l.LineDescription)
            .OrderByDescending(g => g.Count())
            .ThenByDescending(g => g.Max(l => l.Id))
            .Select(g => g.Key)
            .Take(8)
            .ToListAsync();

        return Ok(results);
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================
    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }

    private async Task<string> GenerateReferenceNumberAsync(Guid userId, string journalType)
    {
        var prefix = journalType == "Adjusting" ? "AJE" : "GJ";

        var lastNumber = await _db.JournalEntries
            .Where(e => e.UserId == userId && e.ReferenceNumber.StartsWith(prefix + "-"))
            .OrderByDescending(e => e.Id)
            .Select(e => e.ReferenceNumber)
            .FirstOrDefaultAsync();

        var nextSeq = 1;
        if (lastNumber != null)
        {
            var parts = lastNumber.Split('-');
            if (parts.Length == 2 && int.TryParse(parts[1], out var lastSeq))
            {
                nextSeq = lastSeq + 1;
            }
        }

        return $"{prefix}-{nextSeq:D6}";
    }
}
