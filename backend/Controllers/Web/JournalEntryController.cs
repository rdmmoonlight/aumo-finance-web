using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoFinance.Models;
using AumoFinance.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Controllers.Web;

[ApiController]
[Route("web/journal-entries")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class JournalEntryWebController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITransactionNumberService _transactionNumberService;

    public JournalEntryWebController(AppDbContext db, ITransactionNumberService transactionNumberService)
    {
        _db = db;
        _transactionNumberService = transactionNumberService;
    }

    // ==========================================
    // 1. GET: /web/journal-entries/{id}
    // ==========================================
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) 
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

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
            entry.UpdatedAt,
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
    // 2. POST: /web/journal-entries/create
    // ==========================================
    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] CreateJournalEntryWebRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) 
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

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
        string transactionNumber = await _transactionNumberService.GenerateAsync(userId, journalType, request.EntryDate);

        var deviceCreatedAt = request.CreatedAt == default ? DateTime.UtcNow : request.CreatedAt;

        var entry = new JournalEntry
        {
            UserId = userId,
            TransactionNumber = transactionNumber,
            JournalType = journalType,
            EntryDate = DateTime.SpecifyKind(request.EntryDate, DateTimeKind.Utc),
            CreatedAt = DateTime.SpecifyKind(deviceCreatedAt, DateTimeKind.Utc),
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
    // 3. PUT: /web/journal-entries/edit/{id}
    // ==========================================
    [HttpPut("edit/{id:int}")]
    public async Task<IActionResult> Edit(int id, [FromBody] UpdateJournalEntryWebRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) 
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

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

        var deviceUpdatedAt = request.UpdatedAt == default ? DateTime.UtcNow : request.UpdatedAt;
        entry.UpdatedAt = DateTime.SpecifyKind(deviceUpdatedAt, DateTimeKind.Utc);

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
    // 4. DELETE: /web/journal-entries/delete/{id}
    // ==========================================
    [HttpDelete("delete/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) 
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

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
    // 5. GET: /web/journal-entries/search-descriptions
    // ==========================================
    [HttpGet("search-descriptions")]
    public async Task<IActionResult> SearchDescriptions([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
        {
            return Ok(Array.Empty<string>());
        }

        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) 
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

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
    // 6. GET: /web/journal-entries/next-transaction-number
    // ==========================================
    [HttpGet("next-transaction-number")]
    public async Task<IActionResult> GetNextTransactionNumber([FromQuery] string journalType = "General", [FromQuery] DateTime? entryDate = null)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) 
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        string type = string.IsNullOrWhiteSpace(journalType) ? "General" : journalType;

        string nextNumber = await _transactionNumberService.PeekNextAsync(userId, type, entryDate ?? DateTime.Today);

        return Ok(new { success = true, transactionNumber = nextNumber });
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) 
                     ?? User.FindFirstValue("sub");

        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class CreateJournalEntryWebRequest
{
    public string JournalType { get; set; } = "General";
    public DateTime EntryDate { get; set; } = DateTime.Today;
    public DateTime CreatedAt { get; set; }
    public List<JournalEntryLineWebRequest> Lines { get; set; } = new();
}

public class UpdateJournalEntryWebRequest
{
    public string JournalType { get; set; } = "General";
    public DateTime EntryDate { get; set; } = DateTime.Today;
    public DateTime UpdatedAt { get; set; }
    public List<JournalEntryLineWebRequest> Lines { get; set; } = new();
}

public class JournalEntryLineWebRequest
{
    public int AccountId { get; set; }
    public string? LineDescription { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}