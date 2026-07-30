using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public class DashboardController : Controller
    {
        private readonly AppDbContext _db;

        public DashboardController(AppDbContext db)
        {
            _db = db;
        }

        public async Task<IActionResult> Index(string period = "monthly")
        {
            var model = new DashboardViewModel();
            var isAnnual = period.Equals("annual", StringComparison.OrdinalIgnoreCase);
            
            ViewData["CurrentPeriodType"] = isAnnual ? "annual" : "monthly";

            var now = DateTime.UtcNow;
            DateTime periodStart;
            DateTime periodEnd;

            // 1. Tentukan Periode Berdasarkan Switch (Monthly / Annual)
            if (isAnnual)
            {
                periodStart = new DateTime(now.Year, 1, 1);
                periodEnd = new DateTime(now.Year, 12, 31, 23, 59, 59);
                model.ActivePeriodName = $"Year {now.Year}";
            }
            else
            {
                // Cek periode aktif dari database jika ada
                var activePeriod = await _db.Periods
                    .Where(p => !p.IsClosed)
                    .OrderByDescending(p => p.StartDate)
                    .FirstOrDefaultAsync();

                if (activePeriod != null)
                {
                    model.ActivePeriodName = activePeriod.PeriodName;
                    periodStart = activePeriod.StartDate;
                    periodEnd = activePeriod.EndDate;
                }
                else
                {
                    periodStart = new DateTime(now.Year, now.Month, 1);
                    periodEnd = new DateTime(now.Year, now.Month, DateTime.DaysInMonth(now.Year, now.Month), 23, 59, 59);
                    model.ActivePeriodName = now.ToString("MMMM yyyy");
                }
            }

            model.ActivePeriodStart = periodStart;
            model.ActivePeriodEnd = periodEnd;

            // 2. Ambil Akun & Jurnal Lines
            var accounts = await _db.ChartOfAccounts
                .Where(a => a.IsActive)
                .OrderBy(a => a.ReferenceNumber)
                .ToListAsync();

            var lines = await _db.JournalEntryLines
                .Include(l => l.JournalEntry)
                .Include(l => l.Account)
                .Where(l => l.JournalEntry != null)
                .ToListAsync();

            // 3. Hitung Net Balance Akun Kumulatif (Assets, Liabilities, Cash)
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

            model.TotalCashAndEquivalents = accounts
                .Where(a => a.Role == "CashAndEquivalents")
                .Sum(a => accountBalances.GetValueOrDefault(a.Id));

            model.TotalAssets = accounts
                .Where(a => a.Type == "Assets")
                .Sum(a => accountBalances.GetValueOrDefault(a.Id));

            model.TotalLiabilities = accounts
                .Where(a => a.Type == "Liabilities")
                .Sum(a => accountBalances.GetValueOrDefault(a.Id));

            // 4. Hitung Revenue & Expense Sesuai Periode Pilihan (Monthly / Annual)
            var filteredLines = lines.Where(l =>
                l.JournalEntry!.EntryDate >= periodStart &&
                l.JournalEntry!.EntryDate <= periodEnd);

            decimal SumByType(string type)
            {
                var ids = accounts.Where(a => a.Type == type).Select(a => a.Id).ToHashSet();
                var normalDebit = AccountClassification.NormalBalanceIsDebit(type);
                var relevant = filteredLines.Where(l => ids.Contains(l.AccountId));
                return normalDebit
                    ? relevant.Sum(l => l.Debit - l.Credit)
                    : relevant.Sum(l => l.Credit - l.Debit);
            }

            model.RevenueThisPeriod = SumByType("OperatingIncome") + SumByType("OtherIncome");
            model.OperatingExpenses = SumByType("OperatingExpenses") + SumByType("OtherExpenses");
            model.NetIncome = model.RevenueThisPeriod - model.OperatingExpenses;

            // 5. Tren Periode Sebelumnya (Prior Month atau Prior Year)
            DateTime priorStart = isAnnual ? periodStart.AddYears(-1) : periodStart.AddMonths(-1);
            DateTime priorEnd = isAnnual ? periodEnd.AddYears(-1) : periodStart.AddDays(-1);

            var priorLines = lines.Where(l =>
                l.JournalEntry!.EntryDate >= priorStart &&
                l.JournalEntry!.EntryDate <= priorEnd);

            decimal PriorSumByType(string type)
            {
                var ids = accounts.Where(a => a.Type == type).Select(a => a.Id).ToHashSet();
                var normalDebit = AccountClassification.NormalBalanceIsDebit(type);
                var relevant = priorLines.Where(l => ids.Contains(l.AccountId));
                return normalDebit
                    ? relevant.Sum(l => l.Debit - l.Credit)
                    : relevant.Sum(l => l.Credit - l.Debit);
            }

            var priorRevenue = PriorSumByType("OperatingIncome") + PriorSumByType("OtherIncome");
            var priorExpenses = PriorSumByType("OperatingExpenses") + PriorSumByType("OtherExpenses");
            var priorNet = priorRevenue - priorExpenses;

            model.RevenueTrendPercent = CalcTrend(model.RevenueThisPeriod, priorRevenue);
            model.ExpenseTrendPercent = CalcTrend(model.OperatingExpenses, priorExpenses);
            model.NetIncomeTrendPercent = CalcTrend(model.NetIncome, priorNet);
            model.CashTrendPercent = null;

            // 6. Chart Grafik Tren
            var monthly = lines
                .GroupBy(l => new { l.JournalEntry!.EntryDate.Year, l.JournalEntry!.EntryDate.Month })
                .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
                .TakeLast(isAnnual ? 12 : 7)
                .ToList();

            foreach (var g in monthly)
            {
                var label = new DateTime(g.Key.Year, g.Key.Month, 1).ToString("MMM yy");
                model.ChartLabels.Add(label);

                var revIds = accounts.Where(a => a.Type is "OperatingIncome" or "OtherIncome").Select(a => a.Id).ToHashSet();
                var expIds = accounts.Where(a => a.Type is "OperatingExpenses" or "OtherExpenses").Select(a => a.Id).ToHashSet();

                var revenue = g.Where(l => revIds.Contains(l.AccountId)).Sum(l => l.Credit - l.Debit);
                var expense = g.Where(l => expIds.Contains(l.AccountId)).Sum(l => l.Debit - l.Credit);

                model.ChartRevenue.Add(revenue);
                model.ChartExpenses.Add(expense);
            }

            // 7. Komposisi Biaya
            var expenseAccounts = accounts.Where(a => a.Type is "OperatingExpenses" or "OtherExpenses").ToList();
            foreach (var acc in expenseAccounts)
            {
                var amount = filteredLines
                    .Where(l => l.AccountId == acc.Id)
                    .Sum(l => l.Debit - l.Credit);

                if (amount != 0)
                {
                    model.ExpenseCategoryLabels.Add(acc.AccountName);
                    model.ExpenseCategoryValues.Add(amount);
                }
            }

            // 8. Key Account Balances
            var keyRoles = new[] { "CashAndEquivalents", "AccountsReceivable", "AccountsPayable" };
            var keyAccounts = accounts
                .Where(a => keyRoles.Contains(a.Role) || a.Type == "Equity")
                .OrderBy(a => a.ReferenceNumber)
                .Take(6)
                .ToList();

            foreach (var acc in keyAccounts)
            {
                model.MainCoaBalances.Add(new CoaBalanceDto
                {
                    AccountCode = acc.ReferenceNumber.ToString(),
                    AccountName = acc.AccountName,
                    Category = acc.Type,
                    Balance = accountBalances.GetValueOrDefault(acc.Id)
                });
            }

            // 9. Jurnal Terakhir
            model.RecentJournals = await _db.JournalEntries
                .OrderByDescending(j => j.EntryDate)
                .ThenByDescending(j => j.Id)
                .Take(8)
                .Select(j => new JournalEntryDto
                {
                    Date = j.EntryDate,
                    TotalDebit = j.Lines.Sum(l => l.Debit),
                    TotalCredit = j.Lines.Sum(l => l.Credit)
                })
                .ToListAsync();

            return View(model);
        }

        private static decimal? CalcTrend(decimal current, decimal prior)
        {
            if (prior == 0) return current == 0 ? 0 : null;
            return Math.Round((current - prior) / Math.Abs(prior) * 100m, 1);
        }
    }
}
