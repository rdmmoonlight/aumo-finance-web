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

namespace AumoFinance.Controllers.Api.Reports;

[ApiController]
[Route("api/mobile/journal-entries")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class GeneralJournalControllers : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITransactionNumberService _transactionNumberService;

    public GeneralJournalControllers(AppDbContext db, ITransactionNumberService transactionNumberService)
    {
        _db = db;
        _transactionNumberService = transactionNumberService;
    }

    // ==========================================
    // 1. GET: /api/mobile/journal-entries (General Journal List)
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetGeneralJournal()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var selectedPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
        if (selectedPeriod == null)
        {
            return Ok(new
            {
                success = true,
                selectedPeriodName = (string?)null,
                isPeriodClosed = false,
                entries = Array.Empty<object>()
            });
        }

        var entries = await _db.JournalEntries
            .Include(j => j.Lines)
                .ThenInclude(l => l.Account)
            .Where(j => j.UserId == userId
                     && j.EntryDate >= selectedPeriod.StartDate
                     && j.EntryDate <= selectedPeriod.EndDate)
            .OrderBy(j => j.EntryDate)
            .ThenBy(j => j.CreatedAt)
            .ThenBy(j => j.Id)
            .Select(j => new
            {
                j.Id,
                j.TransactionNumber,
                j.JournalType,
                j.EntryDate,
                j.CreatedAt,
                j.UpdatedAt,
                lines = j.Lines.OrderBy(l => l.LineOrder).Select(l => new
                {
                    l.Id,
                    l.AccountId,
                    AccountName = l.Account != null ? l.Account.AccountName : "Unknown",
                    ReferenceNumber = l.Account != null ? l.Account.ReferenceNumber : 0,
                    l.LineDescription,
                    l.Debit,
                    l.Credit,
                    l.LineOrder
                })
            })
            .ToListAsync();

        return Ok(new
        {
            success = true,
            selectedPeriodName = selectedPeriod.PeriodName,
            isPeriodClosed = selectedPeriod.IsClosed,
            entries = entries
        });
    }

    // ==========================================
    // 2. GET: /api/mobile/journal-entries/{id} (Single Entry Detail)
    // ==========================================
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetJournalEntryById(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var entry = await _db.JournalEntries
            .Include(j => j.Lines)
                .ThenInclude(l => l.Account)
            .FirstOrDefaultAsync(j => j.Id == id && j.UserId == userId);

        if (entry == null)
            return NotFound(new { success = false, message = "Journal entry not found." });

        var result = new
        {
            entry.Id,
            entry.TransactionNumber,
            entry.JournalType,
            entry.EntryDate,
            entry.CreatedAt,
            entry.UpdatedAt,
            lines = entry.Lines.OrderBy(l => l.LineOrder).Select(l => new
            {
                l.Id,
                l.AccountId,
                AccountName = l.Account != null ? l.Account.AccountName : "Unknown",
                l.LineDescription,
                l.Debit,
                l.Credit,
                l.LineOrder
            })
        };

        return Ok(new { success = true, entry = result });
    }

    // ==========================================
    // 3. POST: /api/mobile/journal-entries (Create Journal)
    // ==========================================
    [HttpPost]
    public async Task<IActionResult> CreateJournalEntry([FromBody] CreateJournalEntryApiRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var validLines = request.Lines
            .Where(l => l.AccountId != 0 && (l.Debit != 0 || l.Credit != 0))
            .ToList();

        if (validLines.Count < 2)
            return BadRequest(new { success = false, message = "A journal entry must contain at least 2 line items." });

        var totalDebit = validLines.Sum(l => l.Debit);
        var totalCredit = validLines.Sum(l => l.Credit);

        if (totalDebit != totalCredit || totalDebit == 0)
            return BadRequest(new { success = false, message = "Total Debit must equal Total Credit and cannot be zero." });

        var validAccountIds = (await _db.ChartOfAccounts
            .Where(a => a.IsActive && a.UserId == userId)
            .Select(a => a.Id)
            .ToListAsync())
            .ToHashSet();

        if (validLines.Any(l => !validAccountIds.Contains(l.AccountId)))
            return BadRequest(new { success = false, message = "One or more selected accounts are invalid or inactive." });

        var closedPeriods = await _db.Periods
            .Where(p => p.UserId == userId && p.IsClosed)
            .ToListAsync();

        if (PeriodLock.IsDateLocked(request.EntryDate, closedPeriods))
            return BadRequest(new { success = false, message = "Transaction date falls within a closed accounting period." });

        string journalTypeForNumber = string.IsNullOrWhiteSpace(request.JournalType) ? "General" : request.JournalType;
        string transactionNumber = await _transactionNumberService.GenerateAsync(userId, journalTypeForNumber, request.EntryDate);

        var entry = new JournalEntry
        {
            UserId = userId,
            TransactionNumber = transactionNumber,
            JournalType = string.IsNullOrWhiteSpace(request.JournalType) ? "General" : request.JournalType,
            EntryDate = DateTime.SpecifyKind(request.EntryDate, DateTimeKind.Utc),
            CreatedAt = DateTime.UtcNow,
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
            message = $"Journal {entry.TransactionNumber} created successfully.",
            journalId = entry.Id,
            transactionNumber = entry.TransactionNumber
        });
    }

    // ==========================================
    // 4. PUT: /api/mobile/journal-entries/{id} (Update Journal)
    // ==========================================
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateJournalEntry(int id, [FromBody] UpdateJournalEntryApiRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var entry = await _db.JournalEntries
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == id && j.UserId == userId);

        if (entry == null)
            return NotFound(new { success = false, message = "Journal entry not found." });

        var closedPeriods = await _db.Periods
            .Where(p => p.UserId == userId && p.IsClosed)
            .ToListAsync();

        if (PeriodLock.IsDateLocked(entry.EntryDate, closedPeriods) || PeriodLock.IsDateLocked(request.EntryDate, closedPeriods))
            return BadRequest(new { success = false, message = "Cannot edit transactions in closed accounting periods." });

        var validLines = request.Lines
            .Where(l => l.AccountId != 0 && (l.Debit != 0 || l.Credit != 0))
            .ToList();

        if (validLines.Count < 2)
            return BadRequest(new { success = false, message = "A journal entry must contain at least 2 line items." });

        var totalDebit = validLines.Sum(l => l.Debit);
        var totalCredit = validLines.Sum(l => l.Credit);

        if (totalDebit != totalCredit || totalDebit == 0)
            return BadRequest(new { success = false, message = "Total Debit must equal Total Credit and cannot be zero." });

        _db.JournalEntryLines.RemoveRange(entry.Lines);

        entry.EntryDate = DateTime.SpecifyKind(request.EntryDate, DateTimeKind.Utc);
        entry.JournalType = string.IsNullOrWhiteSpace(request.JournalType) ? entry.JournalType : request.JournalType;
        entry.UpdatedAt = DateTime.UtcNow;
        entry.Lines = validLines.Select((l, index) => new JournalEntryLine
        {
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
            message = $"Journal {entry.TransactionNumber} updated successfully."
        });
    }

    // ==========================================
    // 5. DELETE: /api/mobile/journal-entries/{id} (Delete Journal)
    // ==========================================
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteJournalEntry(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var entry = await _db.JournalEntries
            .FirstOrDefaultAsync(j => j.Id == id && j.UserId == userId);

        if (entry == null)
            return NotFound(new { success = false, message = "Journal entry not found." });

        var closedPeriods = await _db.Periods
            .Where(p => p.UserId == userId && p.IsClosed)
            .ToListAsync();

        if (PeriodLock.IsDateLocked(entry.EntryDate, closedPeriods))
            return BadRequest(new { success = false, message = "Cannot delete transactions in closed accounting periods." });

        _db.JournalEntries.Remove(entry);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"Journal {entry.TransactionNumber} deleted successfully."
        });
    }

    // ==========================================
    // 6. GET: /api/mobile/journal-entries/search-descriptions?q=xxx
    // ==========================================
    [HttpGet("search-descriptions")]
    public async Task<IActionResult> SearchDescriptions([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            return Ok(Array.Empty<string>());

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

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }

}

public class CreateJournalEntryApiRequest
{
    public DateTime EntryDate { get; set; }
    public string JournalType { get; set; } = "General";
    public List<JournalLineApiDto> Lines { get; set; } = new();
}

public class UpdateJournalEntryApiRequest
{
    public DateTime EntryDate { get; set; }
    public string JournalType { get; set; } = "General";
    public List<JournalLineApiDto> Lines { get; set; } = new();
}

public class JournalLineApiDto
{
    public int AccountId { get; set; }
    public string? LineDescription { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}
