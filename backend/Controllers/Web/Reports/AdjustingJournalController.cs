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

namespace AumoFinance.Controllers.Web.Reports;

[ApiController]
[Route("web/reports/adjusting-journal")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class AdjustingJournalWebController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdjustingJournalWebController(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /web/reports/adjusting-journal
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetAdjustingJournal()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        var selectedPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
        if (selectedPeriod == null)
        {
            return Ok(new
            {
                success = true,
                hasPeriodSelected = false,
                message = "No accounting period selected.",
                selectedPeriodName = (string?)null,
                isPeriodClosed = false,
                entries = Array.Empty<object>()
            });
        }

        // Pengoptimalan kueri tanggal untuk PostgreSQL Index Scan
        var startUtc = selectedPeriod.StartDate.Date;
        var endUtc = selectedPeriod.EndDate.Date.AddDays(1).AddTicks(-1);

        var entries = await _db.JournalEntries
            .Include(j => j.Lines)
                .ThenInclude(l => l.Account)
            .Where(j => j.UserId == userId
                     && j.JournalType == "Adjusting"
                     && j.EntryDate >= startUtc
                     && j.EntryDate <= endUtc)
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
            hasPeriodSelected = true,
            selectedPeriodName = selectedPeriod.PeriodName,
            isPeriodClosed = selectedPeriod.IsClosed,
            entries = entries
        });
    }

    // ==========================================
    // 2. DELETE: /web/reports/adjusting-journal/{id}
    // ==========================================
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteAdjustingJournal(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        var entry = await _db.JournalEntries
            .FirstOrDefaultAsync(j => j.Id == id && j.UserId == userId && j.JournalType == "Adjusting");

        if (entry == null)
        {
            return NotFound(new { success = false, message = "Adjusting journal entry not found." });
        }

        var selectedPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
        if (selectedPeriod != null && selectedPeriod.IsClosed)
        {
            return BadRequest(new { success = false, message = "Cannot delete entry in a closed accounting period." });
        }

        _db.JournalEntries.Remove(entry);
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Adjusting journal entry deleted successfully." });
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");

        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}
