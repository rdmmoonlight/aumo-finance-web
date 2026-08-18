using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoFinance.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Controllers.Api;

[ApiController]
[Route("api/mobile/dashboard")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class DashboardControllers : ControllerBase
{
    private readonly AppDbContext _db;

    public DashboardControllers(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetDashboardData()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        // 1. Ambil periode yang sedang dipilih di halaman Periods (single source of truth).
        //    Sebelumnya controller ini memakai logikanya sendiri (periode terbuka terbaru
        //    berdasarkan StartDate), sehingga bisa menampilkan periode yang berbeda dari
        //    yang dipilih user di halaman Periods.
        var activePeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);

        // 2. Filter Jurnal Berdasarkan Periode Aktif (atau Bulan Ini jika periode tidak ditemukan)
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
        var cashAccountIds = await _db.ChartOfAccounts
            .Where(a => a.UserId == userId && a.IsActive && a.Role == "CashAndEquivalents")
            .Select(a => a.Id)
            .ToListAsync();

        var totalCashBalance = journalLines
            .Where(l => cashAccountIds.Contains(l.AccountId))
            .Sum(l => l.Debit - l.Credit);

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

        // 7. Hitung Total Liabilities & Equity (Type == "Liabilities" / "Equity")
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

        // Response is flattened to match the Android DashboardApiResponse DTO exactly
        // (selectedPeriodName, totalAssets, totalRevenue, totalExpenses, etc.) instead
        // of using different field names (periodName, totalCash, income, expense) —
        // same root cause as the earlier Worksheet/Income Statement/Retained Earnings
        // bugs: the mobile app always deserialized empty/default values.
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
            recentEntries = Array.Empty<object>()
        });
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}
