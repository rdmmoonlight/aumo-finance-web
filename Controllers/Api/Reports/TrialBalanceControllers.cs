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

        var rows = await BuildTrialBalanceRowsAsync(_db, userId, period, normalizedType);

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

    public static async Task<List<TrialBalanceRowApiResponse>> BuildTrialBalanceRowsAsync(
        AppDbContext db, Guid userId, Period period, string reportType)
    {
        var accounts = await db.ChartOfAccounts
            .Where(a => a.IsActive && a.UserId == userId)
            .OrderBy(a => a.ReferenceNumber)
            .ToListAsync();

        var accountIds = accounts.Select(a => a.Id).ToList();

        // Filter jenis jurnal berdasarkan tipe report
        var linesQuery = db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Where(l => accountIds.Contains(l.AccountId) && l.JournalEntry!.UserId == userId);

        List<JournalEntryLine> lines;
        if (reportType == "post-closing")
        {
            // Post-Closing mencakup General, Adjusting, dan Closing entries
            lines = await linesQuery.Where(l => 
                l.JournalEntry!.JournalType == "General" || 
                l.JournalEntry!.JournalType == "Adjusting" || 
                l.JournalEntry!.JournalType == "Closing").ToListAsync();
        }
        else if (reportType == "adjusted")
        {
            // Adjusted mencakup General dan Adjusting entries
            lines = await linesQuery.Where(l => 
                l.JournalEntry!.JournalType == "General" || 
                l.JournalEntry!.JournalType == "Adjusting").ToListAsync();
        }
        else
        {
            // Unadjusted HANYA General entries
            lines = await linesQuery.Where(l => 
                l.JournalEntry!.JournalType == "General").ToListAsync();
        }

        var result = new List<TrialBalanceRowApiResponse>();

        foreach (var account in accounts)
        {
            var isPermanent = AccountClassification.IsPermanent(account.Type);

            // Pada Post-Closing TB, HANYA tampilkan Akun Riil/Permanent (Aset, Kewajiban, Ekuitas)
            if (reportType == "post-closing" && !isPermanent)
            {
                continue;
            }

            var accountLines = isPermanent
                ? lines.Where(l => l.AccountId == account.Id && l.JournalEntry!.EntryDate <= period.EndDate).ToList()
                : lines.Where(l => l.AccountId == account.Id && l.JournalEntry!.EntryDate >= period.StartDate && l.JournalEntry!.EntryDate <= period.EndDate).ToList();

            if (!accountLines.Any()) continue;

            var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);
            var netBalance = normalDebit
                ? accountLines.Sum(l => l.Debit - l.Credit)
                : accountLines.Sum(l => l.Credit - l.Debit);

            if (netBalance == 0) continue;

            decimal debitAmount = normalDebit ? netBalance : 0m;
            decimal creditAmount = !normalDebit ? netBalance : 0m;

            result.Add(new TrialBalanceRowApiResponse
            {
                AccountId = account.Id,
                ReferenceNumber = account.ReferenceNumber,
                AccountName = account.AccountName,
                Type = account.Type,
                Role = account.Role,
                Debit = debitAmount,
                Credit = creditAmount,
                NetBalance = netBalance,
                NormalBalanceIsDebit = normalDebit
            });
        }

        return result;
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class TrialBalanceRowApiResponse
{
    public int AccountId { get; set; }
    public int ReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public decimal NetBalance { get; set; }
    public bool NormalBalanceIsDebit { get; set; }
}
