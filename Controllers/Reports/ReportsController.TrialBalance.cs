using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public partial class ReportsController
    {
        // ==========================================================
        // TRIAL BALANCE / ADJUSTED TRIAL BALANCE
        // ==========================================================

        public async Task<IActionResult> TrialBalance()
        {
            ViewData["Title"] = "Trial Balance";
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View(new TrialBalanceViewModel { Title = "Trial Balance" });
            }
            ViewBag.SelectedPeriod = period;

            var rows = await BuildTrialBalanceRowsAsync(userId, period, includeAdjusting: false);
            return View(new TrialBalanceViewModel { Title = "Trial Balance", Rows = rows });
        }

        public async Task<IActionResult> AdjustedTrialBalance()
        {
            ViewData["Title"] = "Adjusted Trial Balance";
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View(new TrialBalanceViewModel { Title = "Adjusted Trial Balance" });
            }
            ViewBag.SelectedPeriod = period;

            var rows = await BuildTrialBalanceRowsAsync(userId, period, includeAdjusting: true);
            return View(new TrialBalanceViewModel { Title = "Adjusted Trial Balance", Rows = rows });
        }

        private async Task<List<TrialBalanceRow>> BuildTrialBalanceRowsAsync(Guid userId, Period period, bool includeAdjusting)
        {
            var accounts = await _db.ChartOfAccounts
                .Where(a => a.IsActive && a.UserId == userId)
                .OrderBy(a => a.ReferenceNumber)
                .ToListAsync();

            var accountIds = accounts.Select(a => a.Id).ToList();

            var linesQuery = _db.JournalEntryLines
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

        // ==========================================================
        // WORKSHEET (10 kolom)
        // ==========================================================

        public async Task<IActionResult> Worksheet()
        {
            ViewData["Title"] = "Worksheet";
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View(new WorksheetViewModel());
            }
            ViewBag.SelectedPeriod = period;

            var unadjusted = await BuildTrialBalanceRowsAsync(userId, period, includeAdjusting: false);
            var adjusted = await BuildTrialBalanceRowsAsync(userId, period, includeAdjusting: true);

            var accounts = await _db.ChartOfAccounts.Where(a => a.IsActive && a.UserId == userId).OrderBy(a => a.ReferenceNumber).ToListAsync();

            var vm = new WorksheetViewModel();
            var allRefs = unadjusted.Select(r => r.AccountId)
                .Union(adjusted.Select(r => r.AccountId))
                .ToList();

            foreach (var accountId in allRefs)
            {
                var account = accounts.First(a => a.Id == accountId);
                var u = unadjusted.FirstOrDefault(r => r.AccountId == accountId);
                var a = adjusted.FirstOrDefault(r => r.AccountId == accountId);
                var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);

                var uDebit = u?.Debit ?? 0;
                var uCredit = u?.Credit ?? 0;
                var aDebit = a?.Debit ?? 0;
                var aCredit = a?.Credit ?? 0;

                var adjNet = (aDebit - aCredit) - (uDebit - uCredit);

                var row = new WorksheetRow
                {
                    AccountId = accountId,
                    ReferenceNumber = account.ReferenceNumber,
                    AccountName = account.AccountName,
                    Type = account.Type,
                    NormalBalanceIsDebit = normalDebit,
                    UnadjustedDebit = uDebit,
                    UnadjustedCredit = uCredit,
                    AdjustmentDebit = adjNet > 0 ? adjNet : 0,
                    AdjustmentCredit = adjNet < 0 ? -adjNet : 0,
                    AdjustedDebit = aDebit,
                    AdjustedCredit = aCredit
                };

                var isTemporary = AccountClassification.IsTemporary(account.Type);
                if (isTemporary)
                {
                    row.IncomeStatementDebit = aDebit;
                    row.IncomeStatementCredit = aCredit;
                }
                else
                {
                    row.FinancialPositionDebit = aDebit;
                    row.FinancialPositionCredit = aCredit;
                }

                vm.Rows.Add(row);
            }

            vm.Rows = vm.Rows.OrderBy(r => r.ReferenceNumber).ToList();
            vm.NetIncome = vm.TotalIncomeStatementCredit - vm.TotalIncomeStatementDebit;

            return View(vm);
        }
    }
}
