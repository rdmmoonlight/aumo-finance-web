using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/mobile")]
public class MobileApiController : ControllerBase
{
    private readonly AppDbContext _db;

    public MobileApiController(AppDbContext db)
    {
        _db = db;
    }

    // GET: api/mobile/dashboard
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        // 1. Periode aktif (sama seperti DashboardController versi web)
        var activePeriod = await _db.Periods
            .Where(p => !p.IsClosed)
            .OrderByDescending(p => p.StartDate)
            .FirstOrDefaultAsync();

        // 2. Semua akun aktif + seluruh baris jurnal
        var accounts = await _db.ChartOfAccounts
            .Where(a => a.IsActive)
            .ToListAsync();

        var lines = await _db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Include(l => l.Account)
            .Where(l => l.JournalEntry != null)
            .ToListAsync();

        // 3. Saldo bersih tiap akun (aturan sama dengan ReportsController/DashboardController)
        var accountBalances = new Dictionary<int, decimal>();
        foreach (var account in accounts)
        {
            var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);
            var accountLines = lines.Where(l => l.AccountId == account.Id);
            var net = normalDebit
                ? accountLines.Sum(l => l.Debit - l.Credit)
                : accountLines.Sum(l => l.Credit - l.Debit);
            accountBalances[account.Id] = net;
        }

        var totalCash = accounts
            .Where(a => a.Role == "CashAndEquivalents")
            .Sum(a => accountBalances.GetValueOrDefault(a.Id));

        // Revenue & Expenses dibatasi ke periode aktif bila ada
        IEnumerable<JournalEntryLine> periodLines = lines;
        if (activePeriod != null)
        {
            periodLines = lines.Where(l =>
                l.JournalEntry!.EntryDate >= activePeriod.StartDate &&
                l.JournalEntry!.EntryDate <= activePeriod.EndDate);
        }

        decimal SumByType(string type)
        {
            var ids = accounts.Where(a => a.Type == type).Select(a => a.Id).ToHashSet();
            var normalDebit = AccountClassification.NormalBalanceIsDebit(type);
            var relevant = periodLines.Where(l => ids.Contains(l.AccountId));
            return normalDebit
                ? relevant.Sum(l => l.Debit - l.Credit)
                : relevant.Sum(l => l.Credit - l.Debit);
        }

        var revenue = SumByType("OperatingIncome") + SumByType("OtherIncome");
        var expenses = SumByType("OperatingExpenses") + SumByType("OtherExpenses");
        var netIncome = revenue - expenses;

        return Ok(new
        {
            TotalCash = totalCash,
            Revenue = revenue,
            Expenses = expenses,
            NetIncome = netIncome,
            ActivePeriod = activePeriod?.PeriodName ?? "-"
        });
    }
}
