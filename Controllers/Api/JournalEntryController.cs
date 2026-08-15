using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoFinance.Models;
using AumoFinance.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Controllers.Api;

[ApiController]
[Route("api/mobile/journal-entry")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class JournalEntryController : ControllerBase
{
    private readonly AppDbContext _db;

    public JournalEntryController(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /api/mobile/journal-entry/{id} (Get Journal Entry for Editing)
    // ==========================================
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var entry = await _db.JournalEntries
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == id && j.UserId == userId);

        if (entry == null)
        {
            return NotFound(new { success = false, message = "Journal entry not found." });
        }

        var closedPeriods = await _db.Periods
            .Where(p => p.UserId == userId && p.IsClosed)
            .ToListAsync();

        bool isLocked = PeriodLock.IsDateLocked(entry.EntryDate, closedPeriods);

        var result = new
        {
            entry.Id,
            entry.TransactionNumber,
            entry.JournalType,
            entry.EntryDate,
            entry.CreatedAt,
            isLocked,
            lines = entry.Lines.OrderBy(l => l.LineOrder).Select(l => new
            {
                l.Id,
                l.AccountId,
                l.LineDescription,
                l.Debit,
                l.Credit,
                l.LineOrder
            })
        };

        return Ok(new { success = true, entry = result });
    }

    // ==========================================
    // 2. POST: /api/mobile/journal-entry/create (Create New Journal Entry)
    // ==========================================
    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] CreateJournalEntryRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var effectiveLines = request.Lines
            .Where(l => l.AccountId != 0 && (l.Debit != 0 || l.Credit != 0))
            .ToList();

        if (effectiveLines.Count < 2)
        {
            return BadRequest(new { success = false, message = "A journal entry must have at least two line items." });
        }

        var totalDebit = effectiveLines.Sum(l => l.Debit);
        var totalCredit = effectiveLines.Sum(l => l.Credit);

        if (totalDebit != totalCredit || totalDebit == 0)
        {
            return BadRequest(new { success = false, message = "Total debit must equal total credit before posting." });
        }

        var validAccountIds = (await _db.ChartOfAccounts
            .Where(a => a.IsActive && a.UserId == userId)
            .Select(a => a.Id)
            .ToListAsync())
            .ToHashSet();

        if (effectiveLines.Any(l => !validAccountIds.Contains(l.AccountId)))
        {
            return BadRequest(new { success = false, message = "One or more selected accounts are invalid or inactive." });
        }

        var closedPeriods = await _db.Periods
            .Where(p => p.UserId == userId && p.IsClosed)
            .ToListAsync();

        if (PeriodLock.IsDateLocked(request.EntryDate, closedPeriods))
        {
            return BadRequest(new { success = false, message = "This date falls within a closed accounting period. Choose a date in an open period." });
        }

        string journalType = string.IsNullOrWhiteSpace(request.JournalType) ? "General" : request.JournalType;
        string transactionNumber = await GenerateTransactionNumberAsync(userId, journalType);

        var entry = new JournalEntry
        {
            UserId = userId,
            TransactionNumber = transactionNumber,
            JournalType = journalType,
            EntryDate = DateTime.SpecifyKind(request.EntryDate, DateTimeKind.Utc),
            // CreatedAt sengaja tidak di-set — kolom database punya
            // default now() dan mengisinya otomatis saat baris di-insert.
            Lines = effectiveLines.Select((l, index) => new JournalEntryLine
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
            message = $"Journal entry {entry.TransactionNumber} has been posted.",
            entryId = entry.Id,
            transactionNumber = entry.TransactionNumber
        });
    }

    // ==========================================
    // 3. PUT: /api/mobile/journal-entry/edit/{id} (Update Existing Journal Entry)
    // ==========================================
    [HttpPut("edit/{id:int}")]
    public async Task<IActionResult> Edit(int id, [FromBody] UpdateJournalEntryRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var entry = await _db.JournalEntries
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == id && j.UserId == userId);

        if (entry == null)
        {
            return NotFound(new { success = false, message = "Journal entry not found." });
        }

        var closedPeriods = await _db.Periods
            .Where(p => p.UserId == userId && p.IsClosed)
            .ToListAsync();

        if (PeriodLock.IsDateLocked(entry.EntryDate, closedPeriods) || PeriodLock.IsDateLocked(request.EntryDate, closedPeriods))
        {
            return BadRequest(new { success = false, message = $"Journal entry {entry.TransactionNumber} falls within a closed period and cannot be modified." });
        }

        var effectiveLines = request.Lines
            .Where(l => l.AccountId != 0 && (l.Debit != 0 || l.Credit != 0))
            .ToList();

        if (effectiveLines.Count < 2)
        {
            return BadRequest(new { success = false, message = "A journal entry must have at least two line items." });
        }

        var totalDebit = effectiveLines.Sum(l => l.Debit);
        var totalCredit = effectiveLines.Sum(l => l.Credit);

        if (totalDebit != totalCredit || totalDebit == 0)
        {
            return BadRequest(new { success = false, message = "Total debit must equal total credit before posting." });
        }

        var validAccountIds = (await _db.ChartOfAccounts
            .Where(a => a.IsActive && a.UserId == userId)
            .Select(a => a.Id)
            .ToListAsync())
            .ToHashSet();

        if (effectiveLines.Any(l => !validAccountIds.Contains(l.AccountId)))
        {
            return BadRequest(new { success = false, message = "One or more selected accounts are invalid or inactive." });
        }

        entry.JournalType = string.IsNullOrWhiteSpace(request.JournalType) ? entry.JournalType : request.JournalType;
        entry.EntryDate = DateTime.SpecifyKind(request.EntryDate, DateTimeKind.Utc);

        _db.JournalEntryLines.RemoveRange(entry.Lines);

        entry.Lines = effectiveLines.Select((l, index) => new JournalEntryLine
        {
            JournalEntryId = entry.Id,
            AccountId = l.AccountId,
            LineDescription = l.LineDescription,
            Debit = l.Debit,
            Credit = l.Credit,
            LineOrder = index
        }).ToList();

        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"Journal entry {entry.TransactionNumber} updated successfully."
        });
    }

    // ==========================================
    // 4. DELETE: /api/mobile/journal-entry/delete/{id} (Delete Journal Entry)
    // ==========================================
    [HttpDelete("delete/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var entry = await _db.JournalEntries
            .FirstOrDefaultAsync(j => j.Id == id && j.UserId == userId);

        if (entry == null)
        {
            return NotFound(new { success = false, message = "Journal entry not found." });
        }

        var closedPeriods = await _db.Periods
            .Where(p => p.UserId == userId && p.IsClosed)
            .ToListAsync();

        if (PeriodLock.IsDateLocked(entry.EntryDate, closedPeriods))
        {
            return BadRequest(new { success = false, message = "Cannot delete transactions in closed accounting periods." });
        }

        _db.JournalEntries.Remove(entry);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"Journal entry {entry.TransactionNumber} deleted successfully."
        });
    }

    // ==========================================
    // 5. GET: /api/mobile/journal-entry/search-descriptions?q=xxx (Description Auto-complete)
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
    // 6. GET: /api/mobile/journal-entry/next-transaction-number?journalType=General (Preview Next Number)
    // ==========================================
    [HttpGet("next-transaction-number")]
    public async Task<IActionResult> GetNextTransactionNumber([FromQuery] string journalType = "General")
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        string type = string.IsNullOrWhiteSpace(journalType) ? "General" : journalType;
        string nextNumber = await GenerateTransactionNumberAsync(userId, type);

        return Ok(new { success = true, transactionNumber = nextNumber });
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }

    private async Task<string> GenerateTransactionNumberAsync(Guid userId, string journalType)
    {
        var prefix = journalType == "Adjusting" ? "AJE" : "GJ";

        var lastNumber = await _db.JournalEntries
            .Where(e => e.UserId == userId && e.TransactionNumber.StartsWith(prefix + "-"))
            .OrderByDescending(e => e.Id)
            .Select(e => e.TransactionNumber)
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

public class CreateJournalEntryRequest
{
    public string JournalType { get; set; } = "General";
    public DateTime EntryDate { get; set; } = DateTime.Today;

    // CreatedAt tidak lagi dikirim oleh client — kolom database yang
    // mengisinya otomatis (default now()) saat baris di-insert.
    public List<JournalEntryLineRequest> Lines { get; set; } = new();
}

public class UpdateJournalEntryRequest
{
    public string JournalType { get; set; } = "General";
    public DateTime EntryDate { get; set; } = DateTime.Today;
    public List<JournalEntryLineRequest> Lines { get; set; } = new();
}

public class JournalEntryLineRequest
{
    public int AccountId { get; set; }
    public string? LineDescription { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}
