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
[Route("web/reports/general-journal")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class GeneralJournalWebController : ControllerBase
{
    private readonly AppDbContext _db;

    public GeneralJournalWebController(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /web/reports/general-journal (General Journal Report)
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetGeneralJournal()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        var selectedPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
        if (selectedPeriod == null)
        {
            return NotFound(new
            {
                success = false,
                hasPeriodSelected = false,
                message = "No accounting period selected.",
                selectedPeriodName = (string?)null,
                isPeriodClosed = false,
                entries = Array.Empty<object>()
            });
        }

        var start = selectedPeriod.StartDate.Date;
        var end = selectedPeriod.EndDate.Date;

        var entries = await _db.JournalEntries
            .Include(j => j.Lines)
                .ThenInclude(l => l.Account)
            .Where(j => j.UserId == userId
                     && j.JournalType == "General"
                     && j.EntryDate.Date >= start
                     && j.EntryDate.Date <= end)
            .OrderBy(j => j.EntryDate)
            .ThenBy(j => j.CreatedAt)
            .ThenBy(j => j.Id)
            .Select(j => new
            {
                j.Id,
                j.TransactionNumber,
                j.JournalType,
                EntryDate = j.EntryDate.ToString("yyyy-MM-dd"),
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

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");

        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}
