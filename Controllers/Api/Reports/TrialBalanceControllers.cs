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
[Route("api/mobile/reports/trial-balance")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class TrialBalanceControllers : ControllerBase
{
    private readonly AppDbContext _db;

    public TrialBalanceControllers(AppDbContext db)
    {
        _db = db;
    }

    // =========================================================================
    // GET: /api/mobile/reports/trial-balance?type=unadjusted|adjusted|post-closing
    // =========================================================================
    [HttpGet]
    public async Task<IActionResult> GetTrialBalance([FromQuery] string type = "unadjusted")
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        string normalizedType = type?.ToLower().Trim() switch
        {
            "adjusted" => "adjusted",
            "postclosing" or "post-closing" => "post-closing",
            _ => "unadjusted"
        };

        string title = normalizedType switch
        {
            "adjusted" => "Adjusted Trial Balance",
            "post-closing" => "Post-Closing Trial Balance",
            _ => "Trial Balance (Unadjusted)"
        };

        var period = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
        if (period == null)
        {
            return Ok(new
            {
                success = true,
                hasPeriodSelected = false,
                message = "No accounting period selected.",
                reportTitle = title,
                type = normalizedType,
                totalDebit = 0m,
                totalCredit = 0m,
                isBalanced = true,
                rows = Array.Empty<object>()
            });
        }

        bool includeAdjusting = normalizedType == "adjusted" || normalizedType == "post-closing";
        var rows = await BuildTrialBalanceRowsAsync(_db, userId, period, includeAdjusting, normalizedType);

        decimal totalDebit = rows.Sum(r => r.Debit);
        decimal totalCredit = rows.Sum(r => r.Credit);
        bool isBalanced = Math.Round(totalDebit - totalCredit, 2) == 0;

        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = period.PeriodName,
            reportTitle = title,
            type = normalizedType,
            totalDebit = totalDebit,
            totalCredit = totalCredit,
            isBalanced = isBalanced,
            rows = rows
        });
    }

    /// <summary>
    /// Membangun data neraca saldo yang selaras dengan komponen Blazor Web.
    /// Kompatibel dengan pemanggilan dari Controller Laporan lain (Income Statement, Retained Earnings, dsb).
    /// </summary>
    public static async Task<List<TrialBalanceRow>> BuildTrialBalanceRowsAsync(
        AppDbContext db,
        Guid userId,
        Period period,
        bool includeAdjusting = false,
        string reportType = "unadjusted")
    {
        var accounts = await db.ChartOfAccounts
            .Where(a => a.IsActive && a.UserId == userId)
            .OrderBy(a => a.ReferenceNumber)
            .ToListAsync();

        var accountIds = accounts.Select(a => a.Id).ToList();

        var linesQuery = db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Where(l => accountIds.Contains(l.AccountId) && l.JournalEntry!.UserId == userId);

        List<JournalEntryLine> lines;
        if (reportType == "post-closing")
        {
            lines = await linesQuery.Where(l =>
                l.JournalEntry!.JournalType == "General" ||
                l.JournalEntry!.JournalType == "Adjusting" ||
                l.JournalEntry!.JournalType == "Closing").ToListAsync();
        }
        else if (includeAdjusting || reportType == "adjusted")
        {
            lines = await linesQuery.Where(l =>
                l.JournalEntry!.JournalType == "General" ||
                l.JournalEntry!.JournalType == "Adjusting").ToListAsync();
        }
        else
        {
            lines = await linesQuery.Where(l =>
                l.JournalEntry!.JournalType == "General").ToListAsync();
        }

        var rows = new List<TrialBalanceRow>();
        foreach (var account in accounts)
        {
            var isPermanent = AccountClassification.IsPermanent(account.Type);

            // Tapis akun non-permanen untuk laporan post-closing
            if (reportType == "post-closing" && !isPermanent)
            {
                continue;
            }

            var accountLines = isPermanent
                ? lines.Where(l => l.AccountId == account.Id && l.JournalEntry!.EntryDate <= period.EndDate).ToList()
                : lines.Where(l => l.AccountId == account.Id && l.JournalEntry!.EntryDate >= period.StartDate && l.JournalEntry!.EntryDate <= period.EndDate).ToList();

            var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);
            var netBalance = normalDebit
                ? accountLines.Sum(l => l.Debit - l.Credit)
                : accountLines.Sum(l => l.Credit - l.Debit);

            if (!accountLines.Any() && netBalance == 0) continue;

            rows.Add(new TrialBalanceRow
            {
                AccountId = account.Id,
                ReferenceNumber = account.ReferenceNumber,
                AccountName = account.AccountName,
                Type = account.Type,
                Role = account.Role,
                NormalBalanceIsDebit = normalDebit,
                NetBalance = netBalance
            });
        }

        return rows;
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}
