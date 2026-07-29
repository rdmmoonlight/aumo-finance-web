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

        public async Task<IActionResult> Index()
        {
            var model = new DashboardViewModel();

            // 1. Active period
            var activePeriod = await _db.Periods
                .Where(p => !p.IsClosed)
                .OrderByDescending(p => p.StartDate)
                .FirstOrDefaultAsync();

            if (activePeriod != null)
            {
                model.ActivePeriodName = activePeriod.PeriodName;
                model.ActivePeriodStart = activePeriod.StartDate;
                model.ActivePeriodEnd = activePeriod.EndDate;
            }

            // 2. All active accounts + all journal lines
            var accounts = await _db.ChartOfAccounts
                .Where(a => a.IsActive)
                .OrderBy(a => a.ReferenceNumber)
                .ToListAsync();

            var lines = await _db.JournalEntryLines
                .Include(l => l.JournalEntry)
                .Include(l => l.Account)
                .Where(l => l.JournalEntry != null)
                .ToListAsync();

            // 3. Compute net balance for every account (same rule as ReportsController)
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

            // 4. KPI values
            model.TotalCashAndEquivalents = accounts
                .Where(a => a.Role == "CashAndEquivalents")
                .Sum(a => accountBalances.GetValueOrDefault(a.Id));

            model.TotalAssets = accounts
                .Where(a => a.Type == "Assets")
                .Sum(a => accountBalances.GetValueOrDefault(a.Id));

            model.TotalLiabilities = accounts
                .Where(a => a.Type == "Liabilities")
                .Sum(a => accountBalances.GetValueOrDefault(a.Id));

            // Revenue & Expenses limited to the active period when one exists
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

            model.RevenueThisPeriod =
                SumByType("OperatingIncome") + SumByType("OtherIncome");

            model.OperatingExpenses =
                SumByType("OperatingExpenses") + SumByType("OtherExpenses");

            model.NetIncome = model.RevenueThisPeriod - model.OperatingExpenses;

            // 5. Prior-period trends
            var priorPeriod = await _db.Periods
                .Where(p => p.IsClosed)
                .OrderByDescending(p => p.EndDate)
                .FirstOrDefaultAsync();

            if (priorPeriod != null)
            {
                var priorLines = lines.Where(l =>
                    l.JournalEntry!.EntryDate >= priorPeriod.StartDate &&
                    l.JournalEntry!.EntryDate <= priorPeriod.EndDate);

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
                model.CashTrendPercent = null; // cumulative; leave null for now
            }

            // 6. Monthly trend chart (last 7 months that contain data)
            var monthly = lines
                .GroupBy(l => new { l.JournalEntry!.EntryDate.Year, l.JournalEntry!.EntryDate.Month })
                .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
                .TakeLast(7)
                .ToList();

            foreach (var g in monthly)
            {
                var label = new DateTime(g.Key.Year, g.Key.Month, 1).ToString("MMM yy");
                model.ChartLabels.Add(label);

                var revIds = accounts
                    .Where(a => a.Type is "OperatingIncome" or "OtherIncome")
                    .Select(a => a.Id).ToHashSet();
                var expIds = accounts
                    .Where(a => a.Type is "OperatingExpenses" or "OtherExpenses")
                    .Select(a => a.Id).ToHashSet();

                var revenue = g.Where(l => revIds.Contains(l.AccountId))
                               .Sum(l => l.Credit - l.Debit);
                var expense = g.Where(l => expIds.Contains(l.AccountId))
                               .Sum(l => l.Debit - l.Credit);

                model.ChartRevenue.Add(revenue);
                model.ChartExpenses.Add(expense);
            }

            // 7. Expense composition (current period)
            var expenseAccounts = accounts
                .Where(a => a.Type is "OperatingExpenses" or "OtherExpenses")
                .ToList();

            foreach (var acc in expenseAccounts)
            {
                var amount = periodLines
                    .Where(l => l.AccountId == acc.Id)
                    .Sum(l => l.Debit - l.Credit);

                if (amount != 0)
                {
                    model.ExpenseCategoryLabels.Add(acc.AccountName);
                    model.ExpenseCategoryValues.Add(amount);
                }
            }

            // 8. Key account balances
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

            // 9. Recent journal entries (latest 8)
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
