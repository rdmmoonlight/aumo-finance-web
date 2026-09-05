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
[Route("web/dashboard")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class DashboardWebController : ControllerBase
{
    private readonly AppDbContext _db;

    public DashboardWebController(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /web/dashboard
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetDashboardData()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) 
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        // 1. Ambil periode yang sedang dipilih
        var activePeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);

        // 2. Filter Jurnal Berdasarkan Periode Aktif
        DateTime startDate = activePeriod?.StartDate ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        DateTime endDate = activePeriod?.EndDate ?? startDate.AddMonths(1).AddDays(-1);

        var journalLines = await _db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Include(l => l.Account)
            .Where(l => l.JournalEntry!.UserId == userId
                     && l.JournalEntry.EntryDate >= startDate
                     && l.JournalEntry.EntryDate <= endDate)
            .ToListAsync();

        // 3. Hitung Kas & Bank (Role == "CashAndEquivalents")
        var cashAndBankAccounts = await _db.ChartOfAccounts
            .Where(a => a.UserId == userId && a.IsActive && a.Role == "CashAndEquivalents")
            .OrderBy(a => a.ReferenceNumber)
            .Select(a => new { a.Id, a.ReferenceNumber, a.AccountName })
            .ToListAsync();

        var cashAndBankBreakdown = cashAndBankAccounts.Select(a => new
        {
            accountId = a.Id,
            referenceNumber = a.ReferenceNumber,
            accountName = a.AccountName,
            balance = journalLines.Where(l => l.AccountId == a.Id).Sum(l => l.Debit - l.Credit),
            isBank = a.AccountName.Contains("Bank", StringComparison.OrdinalIgnoreCase)
        }).ToList();

        var totalCashBalance = cashAndBankBreakdown.Sum(a => a.balance);
        var cashOnlyAccounts = cashAndBankBreakdown.Where(a => !a.isBank).ToList();
        var bankOnlyAccounts = cashAndBankBreakdown.Where(a => a.isBank).ToList();

        // 4. Hitung Total Pendapatan (Type == "OperatingIncome")
        var incomeAccountIds = await _db.ChartOfAccounts
            .Where(a => a.UserId == userId && a.IsActive && a.Type == "OperatingIncome")
            .Select(a => a.Id)
            .ToListAsync();

        var totalIncome = journalLines
            .Where(l => incomeAccountIds.Contains(l.AccountId))
            .Sum(l => l.Credit - l.Debit);

        // 5. Hitung Total Beban (Type == "OperatingExpenses")
        var expenseAccountIds = await _db.ChartOfAccounts
            .Where(a => a.UserId == userId && a.IsActive && a.Type == "OperatingExpenses")
            .Select(a => a.Id)
            .ToListAsync();

        var totalExpense = journalLines
            .Where(l => expenseAccountIds.Contains(l.AccountId))
            .Sum(l => l.Debit - l.Credit);

        // 6. Hitung Laba Bersih
        var netIncome = totalIncome - totalExpense;

        // 7. Hitung Total Liabilities & Equity
        var liabilityAccountIds = await _db.ChartOfAccounts
            .Where(a => a.UserId == userId && a.IsActive && a.Type == "Liabilities")
            .Select(a => a.Id)
            .ToListAsync();

        var totalLiabilities = journalLines
            .Where(l => liabilityAccountIds.Contains(l.AccountId))
            .Sum(l => l.Credit - l.Debit);

        var equityAccountIds = await _db.ChartOfAccounts
            .Where(a => a.UserId == userId && a.IsActive && a.Type == "Equity")
            .Select(a => a.Id)
            .ToListAsync();

        var totalEquity = journalLines
            .Where(l => equityAccountIds.Contains(l.AccountId))
            .Sum(l => l.Credit - l.Debit);

        return Ok(new
        {
            success = true,
            hasPeriodSelected = activePeriod != null,
            selectedPeriodName = activePeriod?.PeriodName,
            isPeriodClosed = activePeriod?.IsClosed ?? false,
            totalAssets = totalCashBalance,
            totalLiabilities = totalLiabilities,
            totalEquity = totalEquity,
            totalRevenue = totalIncome,
            totalExpenses = totalExpense,
            netIncome = netIncome,
            cashAccounts = cashOnlyAccounts.Select(a => new { accountId = a.accountId, referenceNumber = a.referenceNumber, accountName = a.accountName, balance = a.balance }),
            totalCashOnHand = cashOnlyAccounts.Sum(a => a.balance),
            bankAccounts = bankOnlyAccounts.Select(a => new { accountId = a.accountId, referenceNumber = a.referenceNumber, accountName = a.accountName, balance = a.balance }),
            totalBankBalance = bankOnlyAccounts.Sum(a => a.balance),
            recentEntries = Array.Empty<object>()
        });
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) 
                     ?? User.FindFirstValue("sub");
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}