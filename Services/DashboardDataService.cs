namespace AumoFinance.Services;

using AumoFinance.Models;
using Microsoft.EntityFrameworkCore;

public class DashboardDataService
{
    private readonly AppDbContext _db;

    public DashboardDataService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<DashboardViewModel> GetDashboardDataAsync(Guid userId, string periodType)
    {
        // PERBAIKAN: Mengisi UserId agar tidak bernilai Guid.Empty
        // ketika dilempar dari Razor View ke Blazor Component
        var newModel = new DashboardViewModel
        {
            UserId = userId
        };

        var isAnnual = periodType == "annual";

        var selectedPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
        if (selectedPeriod == null)
        {
            newModel.HasSelectedPeriod = false;
            return newModel;
        }

        newModel.HasSelectedPeriod = true;
        newModel.IsSelectedPeriodClosed = selectedPeriod.IsClosed;

        DateTime periodStart, periodEnd;
        if (isAnnual)
        {
            var year = selectedPeriod.StartDate.Year;
            periodStart = DateTime.SpecifyKind(new DateTime(year, 1, 1, 0, 0, 0), DateTimeKind.Utc);
            periodEnd = DateTime.SpecifyKind(new DateTime(year, 12, 31, 23, 59, 59), DateTimeKind.Utc);
            newModel.ActivePeriodName = $"Year {year}";
        }
        else
        {
            periodStart = DateTime.SpecifyKind(selectedPeriod.StartDate, DateTimeKind.Utc);
            periodEnd = DateTime.SpecifyKind(selectedPeriod.EndDate, DateTimeKind.Utc);
            newModel.ActivePeriodName = selectedPeriod.PeriodName;
        }

        newModel.ActivePeriodStart = periodStart;
        newModel.ActivePeriodEnd = periodEnd;

        var accounts = await _db.ChartOfAccounts.Where(a => a.IsActive && a.UserId == userId).OrderBy(a => a.ReferenceNumber).ToListAsync();
        var lines = await _db.JournalEntryLines.Include(l => l.JournalEntry).Include(l => l.Account)
            .Where(l => l.JournalEntry != null && l.JournalEntry.UserId == userId && l.JournalEntry.EntryDate <= periodEnd).ToListAsync();

        var accountBalances = accounts.ToDictionary(a => a.Id, a =>
        {
            var normalDebit = IsNormalBalanceDebitSafe(a.Type);
            var accountLines = lines.Where(l => l.AccountId == a.Id);
            return normalDebit ? accountLines.Sum(l => l.Debit - l.Credit) : accountLines.Sum(l => l.Credit - l.Debit);
        });

        newModel.TotalCashAndEquivalents = accounts.Where(a => a.Role == "CashAndEquivalents").Sum(a => accountBalances.GetValueOrDefault(a.Id));
        newModel.TotalAssets = accounts.Where(a => a.Type == "Assets").Sum(a => accountBalances.GetValueOrDefault(a.Id));
        newModel.TotalLiabilities = accounts.Where(a => a.Type == "Liabilities").Sum(a => accountBalances.GetValueOrDefault(a.Id));

        var filteredLines = lines.Where(l => l.JournalEntry!.EntryDate >= periodStart && l.JournalEntry!.EntryDate <= periodEnd).ToList();

        decimal SumByType(string type)
        {
            var ids = accounts.Where(a => a.Type == type).Select(a => a.Id).ToHashSet();
            var normalDebit = IsNormalBalanceDebitSafe(type);
            var relevant = filteredLines.Where(l => ids.Contains(l.AccountId));
            return normalDebit ? relevant.Sum(l => l.Debit - l.Credit) : relevant.Sum(l => l.Credit - l.Debit);
        }

        newModel.RevenueThisPeriod = SumByType("OperatingIncome") + SumByType("OtherIncome");
        newModel.OperatingExpenses = SumByType("OperatingExpenses") + SumByType("OtherExpenses");
        newModel.NetIncome = newModel.RevenueThisPeriod - newModel.OperatingExpenses;

        DateTime priorStart = isAnnual ? periodStart.AddYears(-1) : periodStart.AddMonths(-1);
        DateTime priorEnd = isAnnual ? periodEnd.AddYears(-1) : periodStart.AddDays(-1);

        var priorLines = lines.Where(l => l.JournalEntry!.EntryDate >= priorStart && l.JournalEntry!.EntryDate <= priorEnd).ToList();
        decimal PriorSumByType(string type)
        {
            var ids = accounts.Where(a => a.Type == type).Select(a => a.Id).ToHashSet();
            var normalDebit = IsNormalBalanceDebitSafe(type);
            var relevant = priorLines.Where(l => ids.Contains(l.AccountId));
            return normalDebit ? relevant.Sum(l => l.Debit - l.Credit) : relevant.Sum(l => l.Credit - l.Debit);
        }

        var priorRevenue = PriorSumByType("OperatingIncome") + PriorSumByType("OtherIncome");
        var priorExpenses = PriorSumByType("OperatingExpenses") + PriorSumByType("OtherExpenses");
        var priorNet = priorRevenue - priorExpenses;

        newModel.RevenueTrendPercent = CalcTrend(newModel.RevenueThisPeriod, priorRevenue);
        newModel.ExpenseTrendPercent = CalcTrend(newModel.OperatingExpenses, priorExpenses);
        newModel.NetIncomeTrendPercent = CalcTrend(newModel.NetIncome, priorNet);

        var monthly = lines.GroupBy(l => new { l.JournalEntry!.EntryDate.Year, l.JournalEntry!.EntryDate.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month).TakeLast(isAnnual ? 12 : 7).ToList();

        foreach (var g in monthly)
        {
            newModel.ChartLabels.Add(new DateTime(g.Key.Year, g.Key.Month, 1).ToString("MMM yy"));
            var revIds = accounts.Where(a => a.Type is "OperatingIncome" or "OtherIncome").Select(a => a.Id).ToHashSet();
            var expIds = accounts.Where(a => a.Type is "OperatingExpenses" or "OtherExpenses").Select(a => a.Id).ToHashSet();
            newModel.ChartRevenue.Add(g.Where(l => revIds.Contains(l.AccountId)).Sum(l => l.Credit - l.Debit));
            newModel.ChartExpenses.Add(g.Where(l => expIds.Contains(l.AccountId)).Sum(l => l.Debit - l.Credit));
        }

        foreach (var acc in accounts.Where(a => a.Type is "OperatingExpenses" or "OtherExpenses"))
        {
            var amount = filteredLines.Where(l => l.AccountId == acc.Id).Sum(l => l.Debit - l.Credit);
            if (amount != 0)
            {
                newModel.ExpenseCategoryLabels.Add(acc.AccountName);
                newModel.ExpenseCategoryValues.Add(amount);
            }
        }

        var keyRoles = new[] { "CashAndEquivalents", "AccountsReceivable", "AccountsPayable" };
        foreach (var acc in accounts.Where(a => (a.Role != null && keyRoles.Contains(a.Role)) || a.Type == "Equity").OrderBy(a => a.ReferenceNumber).Take(6))
        {
            newModel.MainCoaBalances.Add(new CoaBalanceDto
            {
                AccountCode = acc.ReferenceNumber.ToString(),
                AccountName = acc.AccountName,
                Category = acc.Type ?? "Other",
                Balance = accountBalances.GetValueOrDefault(acc.Id)
            });
        }

        newModel.RecentJournals = await _db.JournalEntries.Where(j => j.UserId == userId && j.EntryDate >= periodStart && j.EntryDate <= periodEnd)
            .OrderByDescending(j => j.EntryDate).ThenByDescending(j => j.Id).Take(8)
            .Select(j => new JournalEntryDto { Date = j.EntryDate, TotalDebit = j.Lines.Sum(l => l.Debit), TotalCredit = j.Lines.Sum(l => l.Credit) }).ToListAsync();

        newModel.MonthlyBurnRate = isAnnual ? (newModel.OperatingExpenses / 12m) : newModel.OperatingExpenses;
        newModel.CashRunwayMonths = newModel.MonthlyBurnRate > 0 ? (double)Math.Round(newModel.TotalCashAndEquivalents / newModel.MonthlyBurnRate, 1) : 99;

        int healthScore = 50;
        if (newModel.TotalLiabilities > 0)
        {
            var quickRatio = newModel.TotalCashAndEquivalents / newModel.TotalLiabilities;
            if (quickRatio >= 1.5m) healthScore += 25;
            else if (quickRatio >= 1.0m) healthScore += 15;
            else if (quickRatio >= 0.5m) healthScore += 5;
        }
        else healthScore += 25;

        if (newModel.NetIncome > 0) healthScore += 25;
        else if (newModel.NetIncome < 0) healthScore -= 15;

        newModel.FinancialHealthScore = Math.Clamp(healthScore, 10, 100);
        return newModel;
    }

    private static bool IsNormalBalanceDebitSafe(string? type)
    {
        if (string.IsNullOrWhiteSpace(type)) return true;
        try { return AccountClassification.NormalBalanceIsDebit(type); }
        catch { return type is "Assets" or "OperatingExpenses" or "OtherExpenses"; }
    }

    private static decimal? CalcTrend(decimal current, decimal prior)
    {
        if (prior == 0) return current == 0 ? 0 : null;
        return Math.Round((current - prior) / Math.Abs(prior) * 100m, 1);
    }
}
