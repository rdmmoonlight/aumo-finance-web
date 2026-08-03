using Microsoft.AspNetCore.Mvc;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public partial class ReportsController
    {
        // ==========================================================
        // INCOME STATEMENT
        // ==========================================================

        public async Task<IActionResult> IncomeStatement()
        {
            ViewData["Title"] = "Income Statement";
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View(new IncomeStatementViewModel());
            }
            ViewBag.SelectedPeriod = period;

            var rows = await BuildTrialBalanceRowsAsync(userId, period, includeAdjusting: true);
            var vm = BuildIncomeStatement(rows, period);
            return View(vm);
        }

        private IncomeStatementViewModel BuildIncomeStatement(List<TrialBalanceRow> rows, Period period)
        {
            var vm = new IncomeStatementViewModel { AsOfDate = period.EndDate };

            IncomeStatementLine ToLine(TrialBalanceRow r) => new()
            {
                ReferenceNumber = r.ReferenceNumber,
                AccountName = r.AccountName,
                Amount = r.NetBalance
            };

            vm.Revenues = rows.Where(r => r.Type == "OperatingIncome").Select(ToLine).ToList();
            vm.OperatingExpenses = rows.Where(r => r.Type == "OperatingExpenses").Select(ToLine).ToList();
            vm.OtherIncome = rows.Where(r => r.Type == "OtherIncome").Select(ToLine).ToList();
            vm.OtherExpenses = rows.Where(r => r.Type == "OtherExpenses").Select(ToLine).ToList();

            return vm;
        }

        // ==========================================================
        // RETAINED EARNINGS STATEMENT
        // ==========================================================

        public async Task<IActionResult> RetainedEarnings()
        {
            ViewData["Title"] = "Retained Earnings Statement";
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View(new RetainedEarningsViewModel());
            }
            ViewBag.SelectedPeriod = period;

            var vm = await BuildRetainedEarningsAsync(userId, period);
            return View(vm);
        }

        private async Task<RetainedEarningsViewModel> BuildRetainedEarningsAsync(Guid userId, Period period)
        {
            var rows = await BuildTrialBalanceRowsAsync(userId, period, includeAdjusting: true);
            var incomeStatement = BuildIncomeStatement(rows, period);
            var reAccount = rows.FirstOrDefault(r => r.Role == "RetainedEarnings");

            return new RetainedEarningsViewModel
            {
                AccountName = reAccount?.AccountName ?? "Retained Earnings",
                BeginningBalance = reAccount?.NetBalance ?? 0,
                NetIncome = incomeStatement.NetIncome,
                Dividends = 0
            };
        }

        // ==========================================================
        // STATEMENT OF FINANCIAL POSITION (SOFP) & POST-CLOSING
        // ==========================================================

        public async Task<IActionResult> StatementOfFinancialPosition()
        {
            ViewData["Title"] = "Statement of Financial Position";
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View("StatementOfFinancialPosition", new StatementOfFinancialPositionViewModel());
            }
            ViewBag.SelectedPeriod = period;

            var vm = await BuildSofpAsync(userId, period, isPostClosing: false);
            return View("StatementOfFinancialPosition", vm);
        }

        public async Task<IActionResult> PostClosingTrialBalance()
        {
            ViewData["Title"] = "Post-Closing Trial Balance";
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View("PostClosingTrialBalance", new StatementOfFinancialPositionViewModel());
            }
            ViewBag.SelectedPeriod = period;

            var vm = await BuildSofpAsync(userId, period, isPostClosing: true);
            return View("PostClosingTrialBalance", vm);
        }

        private async Task<StatementOfFinancialPositionViewModel> BuildSofpAsync(Guid userId, Period period, bool isPostClosing)
        {
            var rows = await BuildTrialBalanceRowsAsync(userId, period, includeAdjusting: true);
            var re = await BuildRetainedEarningsAsync(userId, period);

            FinancialPositionLine ToLine(TrialBalanceRow r) => new()
            {
                ReferenceNumber = r.ReferenceNumber,
                AccountName = r.AccountName,
                Amount = r.NetBalance
            };

            var vm = new StatementOfFinancialPositionViewModel
            {
                AsOfDate = period.EndDate,
                IsPostClosing = isPostClosing,
                Assets = rows.Where(r => r.Type == "Assets").Select(ToLine).ToList(),
                Liabilities = rows.Where(r => r.Type == "Liabilities").Select(ToLine).ToList(),
                EquityExcludingRetainedEarnings = rows.Where(r => r.Type == "Equity" && r.Role != "RetainedEarnings").Select(ToLine).ToList(),
                RetainedEarningsEnding = re.EndingBalance
            };

            return vm;
        }

        // ==========================================================
        // CLOSING JOURNAL
        // ==========================================================

        public async Task<IActionResult> ClosingJournal()
        {
            ViewData["Title"] = "Closing Journal";
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View(new ClosingJournalViewModel());
            }
            ViewBag.SelectedPeriod = period;

            var rows = await BuildTrialBalanceRowsAsync(userId, period, includeAdjusting: true);
            var incomeStatement = BuildIncomeStatement(rows, period);
            var reAccountName = rows.FirstOrDefault(r => r.Role == "RetainedEarnings")?.AccountName ?? "Retained Earnings";

            var vm = new ClosingJournalViewModel
            {
                NetIncome = incomeStatement.NetIncome,
                RetainedEarningsAccountName = reAccountName
            };

            var incomeRows = rows.Where(r => r.Type == "OperatingIncome" || r.Type == "OtherIncome").Where(r => r.NetBalance != 0).ToList();
            if (incomeRows.Any())
            {
                var group1 = new ClosingJournalEntryGroup { Description = "Closing Revenue & Other Income to Retained Earnings" };
                foreach (var r in incomeRows)
                {
                    group1.Lines.Add(new ClosingJournalLine { ReferenceNumber = r.ReferenceNumber, AccountName = r.AccountName, Debit = r.NetBalance, Credit = 0 });
                }
                group1.Lines.Add(new ClosingJournalLine { AccountName = reAccountName, Debit = 0, Credit = incomeRows.Sum(r => r.NetBalance) });
                vm.Groups.Add(group1);
            }

            var expenseRows = rows.Where(r => r.Type == "OperatingExpenses" || r.Type == "OtherExpenses").Where(r => r.NetBalance != 0).ToList();
            if (expenseRows.Any())
            {
                var group2 = new ClosingJournalEntryGroup { Description = "Closing Expenses to Retained Earnings" };
                group2.Lines.Add(new ClosingJournalLine { AccountName = reAccountName, Debit = expenseRows.Sum(r => r.NetBalance), Credit = 0 });
                foreach (var r in expenseRows)
                {
                    group2.Lines.Add(new ClosingJournalLine { ReferenceNumber = r.ReferenceNumber, AccountName = r.AccountName, Debit = 0, Credit = r.NetBalance });
                }
                vm.Groups.Add(group2);
            }

            return View(vm);
        }
    }
}
