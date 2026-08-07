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

    // ==========================================
    // 1. GET: /api/mobile/reports/trial-balance?includeAdjusting=false
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetTrialBalance([FromQuery] bool includeAdjusting = false)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var period = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
        if (period == null)
        {
            return Ok(new
            {
                success = true,
                hasPeriodSelected = false,
                message = "No accounting period selected.",
                reportTitle = includeAdjusting ? "Adjusted Trial Balance" : "Trial Balance",
                includeAdjusting = includeAdjusting,
                totalDebit = 0m,
                totalCredit = 0m,
                isBalanced = true,
                rows = Array.Empty<object>()
            });
        }

        var rows = await BuildTrialBalanceRowsAsync(_db, userId, period, includeAdjusting);

        var apiRows = rows.Select(r => new TrialBalanceRowApiResponse
        {
            AccountId = r.AccountId,
            ReferenceNumber = r.ReferenceNumber,
            AccountName = r.AccountName,
            Type = r.Type,
            Role = r.Role,
            Debit = r.Debit,
            Credit = r.Credit,
            NetBalance = r.NetBalance,
            NormalBalanceIsDebit = r.NormalBalanceIsDebit
        }).ToList();

        decimal totalDebit = apiRows.Sum(r => r.Debit);
        decimal totalCredit = apiRows.Sum(r => r.Credit);
        bool isBalanced = Math.Round(totalDebit - totalCredit, 2) == 0;

        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = period.PeriodName,
            reportTitle = includeAdjusting ? "Adjusted Trial Balance" : "Trial Balance",
            includeAdjusting = includeAdjusting,
            totalDebit = totalDebit,
            totalCredit = totalCredit,
            isBalanced = isBalanced,
            rows = apiRows
        });
    }

    public static async Task<List<TrialBalanceRow>> BuildTrialBalanceRowsAsync(AppDbContext db, Guid userId, Period period, bool includeAdjusting)
    {
        var accounts = await db.ChartOfAccounts
            .Where(a => a.IsActive && a.UserId == userId)
            .OrderBy(a => a.ReferenceNumber)
            .ToListAsync();

        var accountIds = accounts.Select(a => a.Id).ToList();

        var linesQuery = db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Where(l => accountIds.Contains(l.AccountId) && l.JournalEntry!.UserId == userId);

        var lines = includeAdjusting
            ? await linesQuery.Where(l => l.JournalEntry!.JournalType == "General" || l.JournalEntry!.JournalType == "Adjusting").ToListAsync()
            : await linesQuery.Where(l => l.JournalEntry!.JournalType == "General").ToListAsync();

        var rows = new List<TrialBalanceRow>();
        foreach (var account in accounts)
        {
            var isPermanent = AccountClassification.IsPermanent(account.Type);
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
