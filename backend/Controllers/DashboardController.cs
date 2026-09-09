using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoBackend.Models;
using AumoBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoBackend.Controllers;

[ApiController]
[Route("/api/v1/dashboard")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;

    public DashboardController(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /api/v1/dashboard?period=monthly|annual
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetDashboardData([FromQuery] string period = "monthly")
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        // 1. Ambil periode aktif yang sedang dipilih (yang diatur dari halaman Periods / COA)
        var activePeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);

        DateTime startDate;
        DateTime endDate;
        string displayPeriodName;

        // 2. Tentukan Tanggal Berdasarkan Mode Tab (Monthly vs Annual)
        if (string.Equals(period, "annual", StringComparison.OrdinalIgnoreCase))
        {
            // Jika Annual: Full 12 bulan di tahun dari periode aktif (atau tahun sekarang jika belum ada periode aktif)
            int year = activePeriod?.StartDate.Year ?? DateTime.UtcNow.Year;
            startDate = new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            endDate = new DateTime(year, 12, 31, 23, 59, 59, DateTimeKind.Utc);
            displayPeriodName = $"Annual {year}";
        }
        else
        {
            // Jika Monthly: Mengikuti persis rentang tanggal periode yang dipilih di page COA/Periods
            startDate = activePeriod?.StartDate ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            endDate = activePeriod?.EndDate ?? startDate.AddMonths(1).AddDays(-1);
            displayPeriodName = activePeriod?.PeriodName ?? "Current Period";
        }

        // 3. Ambil Transaksi Jurnal dalam Rentang Tanggal (untuk Pendapatan, Beban, & Kas/Bank per-scope)
        var periodJournalLines = await _db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Include(l => l.Account)
            .Where(l => l.JournalEntry!.UserId == userId
                     && l.JournalEntry.EntryDate >= startDate
                     && l.JournalEntry.EntryDate <= endDate)
            .ToListAsync();

        // 4. Ambil Transaksi Jurnal Kumulatif s.d. EndDate (khusus untuk Neraca posisi modal/utang kumulatif)
        var cumulativeJournalLines = await _db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry!.UserId == userId
                     && l.JournalEntry.EntryDate <= endDate)
            .ToListAsync();

        // 5. Hitung Kas & Bank (Role == "CashAndEquivalents") -> Dihitung berdasarkan rentang waktu scope yang aktif
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
            balance = periodJournalLines.Where(l => l.AccountId == a.Id).Sum(l => l.Debit - l.Credit),
            isBank = a.AccountName.Contains("Bank", StringComparison.OrdinalIgnoreCase) || a.AccountName.Contains("Rekening", StringComparison.OrdinalIgnoreCase)
        }).ToList();

        var totalCashBalance = cashAndBankBreakdown.Sum(a => a.balance);
        var cashOnlyAccounts = cashAndBankBreakdown.Where(a => !a.isBank).ToList();
        var bankOnlyAccounts = cashAndBankBreakdown.Where(a => a.isBank).ToList();

        // 6. Hitung Total Pendapatan (OperatingIncome / Income / Revenue)
        var incomeTypes = new[] { "OperatingIncome", "Income", "Revenue" };
        var incomeAccountIds = await _db.ChartOfAccounts
            .Where(a => a.UserId == userId && a.IsActive && incomeTypes.Contains(a.Type))
            .Select(a => a.Id)
            .ToListAsync();

        var totalIncome = periodJournalLines
            .Where(l => incomeAccountIds.Contains(l.AccountId))
            .Sum(l => l.Credit - l.Debit);

        // 7. Hitung Total Beban (OperatingExpenses / Expense / Expenses)
        var expenseTypes = new[] { "OperatingExpenses", "Expense", "Expenses" };
        var expenseAccounts = await _db.ChartOfAccounts
            .Where(a => a.UserId == userId && a.IsActive && expenseTypes.Contains(a.Type))
            .OrderBy(a => a.ReferenceNumber)
            .Select(a => new { a.Id, a.ReferenceNumber, a.AccountName })
            .ToListAsync();

        var expenseAccountBreakdown = expenseAccounts.Select(a => new
        {
            accountId = a.Id,
            referenceNumber = a.ReferenceNumber,
            accountName = a.AccountName,
            balance = periodJournalLines.Where(l => l.AccountId == a.Id).Sum(l => l.Debit - l.Credit)
        }).Where(a => a.balance > 0).ToList();

        var totalExpense = expenseAccountBreakdown.Sum(a => a.balance);

        // 8. Hitung Laba Bersih
        var netIncome = totalIncome - totalExpense;

        // 9. Hitung Total Liabilities / Utang (Kumulatif)
        var liabilityTypes = new[] { "Liabilities", "Liability" };
        var liabilityAccountIds = await _db.ChartOfAccounts
            .Where(a => a.UserId == userId && a.IsActive && liabilityTypes.Contains(a.Type))
            .Select(a => a.Id)
            .ToListAsync();

        var totalLiabilities = cumulativeJournalLines
            .Where(l => liabilityAccountIds.Contains(l.AccountId))
            .Sum(l => l.Credit - l.Debit);

        // 10. Hitung Total Equity / Modal (Kumulatif)
        var equityAccountIds = await _db.ChartOfAccounts
            .Where(a => a.UserId == userId && a.IsActive && a.Type == "Equity")
            .Select(a => a.Id)
            .ToListAsync();

        var totalEquity = cumulativeJournalLines
            .Where(l => equityAccountIds.Contains(l.AccountId))
            .Sum(l => l.Credit - l.Debit);

        return Ok(new
        {
            success = true,
            hasPeriodSelected = activePeriod != null,
            selectedPeriodName = displayPeriodName,
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
            expenseAccountsList = expenseAccountBreakdown.Select(a => new { accountId = a.accountId, referenceNumber = a.referenceNumber, accountName = a.accountName, balance = a.balance }),
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
