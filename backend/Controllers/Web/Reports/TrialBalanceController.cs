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
[Route("web/reports/trial-balance")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class TrialBalanceController : ControllerBase
{
    private readonly AppDbContext _db;

    public TrialBalanceController(AppDbContext db)
    {
        _db = db;
    }

    // =========================================================================
    // 1. GET: /web/reports/trial-balance?type=unadjusted|adjusted|post-closing
    // =========================================================================
    [HttpGet]
    public async Task<IActionResult> GetTrialBalance([FromQuery] string type = "unadjusted")
    {
        return await ProcessTrialBalanceAsync(type);
    }

    // =========================================================================
    // 2. GET: /web/reports/trial-balance/unadjusted
    // =========================================================================
    [HttpGet("unadjusted")]
    public async Task<IActionResult> GetUnadjustedTrialBalance()
    {
        return await ProcessTrialBalanceAsync("unadjusted");
    }

    // =========================================================================
    // 3. GET: /web/reports/trial-balance/adjusted
    // =========================================================================
    [HttpGet("adjusted")]
    public async Task<IActionResult> GetAdjustedTrialBalance()
    {
        return await ProcessTrialBalanceAsync("adjusted");
    }

    // =========================================================================
    // 4. GET: /web/reports/trial-balance/post-closing
    // =========================================================================
    [HttpGet("post-closing")]
    public async Task<IActionResult> GetPostClosingTrialBalance()
    {
        return await ProcessTrialBalanceAsync("post-closing");
    }

    private async Task<IActionResult> ProcessTrialBalanceAsync(string type)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

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

        if (normalizedType == "post-closing")
        {
            var reEndingBalance = await ComputeRetainedEarningsEndingAsync(_db, userId, period);
            var reRow = rows.Find(r => r.Role == "RetainedEarnings");

            if (reRow != null)
            {
                reRow.NetBalance = reEndingBalance;
            }
            else if (reEndingBalance != 0)
            {
                var reAccount = await _db.ChartOfAccounts
                    .FirstOrDefaultAsync(a => a.UserId == userId && a.IsActive && a.Role == "RetainedEarnings");

                if (reAccount != null)
                {
                    rows.Add(new TrialBalanceRow
                    {
                        AccountId = reAccount.Id,
                        ReferenceNumber = reAccount.ReferenceNumber,
                        AccountName = reAccount.AccountName,
                        Type = reAccount.Type,
                        Role = reAccount.Role,
                        NormalBalanceIsDebit = false,
                        NetBalance = reEndingBalance
                    });
                    rows.Sort((a, b) => a.ReferenceNumber.CompareTo(b.ReferenceNumber));
                }
            }
        }

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

        var start = period.StartDate.Date;
        var end = period.EndDate.Date;

        var linesQuery = db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Where(l => accountIds.Contains(l.AccountId)
                     && l.JournalEntry!.UserId == userId
                     && l.JournalEntry!.EntryDate.Date >= start
                     && l.JournalEntry!.EntryDate.Date <= end);

        bool includeAdjustingLines = includeAdjusting || reportType == "adjusted" || reportType == "post-closing";

        var lines = includeAdjustingLines
            ? await linesQuery.Where(l => l.JournalEntry!.JournalType == "General"
                                       || l.JournalEntry!.JournalType == "Adjusting").ToListAsync()
            : await linesQuery.Where(l => l.JournalEntry!.JournalType == "General").ToListAsync();

        var rows = new List<TrialBalanceRow>();
        foreach (var account in accounts)
        {
            var isPermanent = AccountClassification.IsPermanent(account.Type);

            if (reportType == "post-closing" && !isPermanent)
            {
                continue;
            }

            var accountLines = lines.Where(l => l.AccountId == account.Id).ToList();

            if (!accountLines.Any()) continue;

            var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);
            var netBalance = normalDebit
                ? accountLines.Sum(l => l.Debit - l.Credit)
                : accountLines.Sum(l => l.Credit - l.Debit);

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

    private static async Task<decimal> ComputeRetainedEarningsEndingAsync(AppDbContext db, Guid userId, Period period)
    {
        var rows = await BuildTrialBalanceRowsAsync(db, userId, period, includeAdjusting: true, reportType: "adjusted");

        decimal totalRevenue = rows
            .Where(r => AccountClassification.IsTemporary(r.Type) && !r.NormalBalanceIsDebit)
            .Sum(r => r.NetBalance);

        decimal totalExpense = rows
            .Where(r => AccountClassification.IsTemporary(r.Type) && r.NormalBalanceIsDebit)
            .Sum(r => r.NetBalance);

        decimal netIncome = totalRevenue - totalExpense;

        var reRow = rows.FirstOrDefault(r => r.Role == "RetainedEarnings");
        decimal initialRE = reRow?.NetBalance ?? 0m;

        return initialRE + netIncome;
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");

        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}
