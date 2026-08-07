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

        // 1. Ambil Periode Aktif (Periode yang belum ditutup / !IsClosed)
        var activePeriod = await _db.Periods
            .Where(p => p.UserId == userId && !p.IsClosed)
            .OrderByDescending(p => p.StartDate)
            .FirstOrDefaultAsync();

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

        return Ok(new
        {
            success = true,
            periodName = activePeriod?.PeriodName ?? "Periode Berjalan",
            totalCash = totalCashBalance,
            income = totalIncome,
            expense = totalExpense,
            netIncome = netIncome
        });
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}
