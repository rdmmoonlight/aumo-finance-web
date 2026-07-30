using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public class ReportsController : Controller
    {
        private readonly AppDbContext _db;

        public ReportsController(AppDbContext db)
        {
            _db = db;
        }

        // ==========================================================
        // GENERAL LEDGER
        // ==========================================================

        // General Ledger: akun riil / permanen (Assets, Liabilities, Equity).
        public async Task<IActionResult> GeneralLedger()
        {
            ViewData["Title"] = "General Ledger";
            var ledgers = await BuildLedgersAsync(AccountClassification.IsPermanent);
            return View(ledgers);
        }

        // General Ledger (Temporary Accounts): akun nominal / sementara
        // (Operating Income, Operating Expenses, Other Income, Other Expenses)
        public async Task<IActionResult> GeneralLedgerTemporary()
        {
            ViewData["Title"] = "General Ledger (Temporary Accounts)";
            var ledgers = await BuildLedgersAsync(AccountClassification.IsTemporary);
            return View(ledgers);
        }

        // ==========================================================
        // TRIAL BALANCE / ADJUSTED TRIAL BALANCE
        // ==========================================================

        // Neraca Saldo (belum disesuaikan): hanya jurnal "General".
        public async Task<IActionResult> TrialBalance()
        {
            ViewData["Title"] = "Trial Balance";
            var rows = await BuildTrialBalanceRowsAsync(includeAdjusting: false);
            return View(new TrialBalanceViewModel { Title = "Trial Balance", Rows = rows });
        }

        // Neraca Saldo Disesuaikan: jurnal "General" + "Adjusting".
        public async Task<IActionResult> AdjustedTrialBalance()
        {
            ViewData["Title"] = "Adjusted Trial Balance";
            var rows = await BuildTrialBalanceRowsAsync(includeAdjusting: true);
            return View(new TrialBalanceViewModel { Title = "Adjusted Trial Balance", Rows = rows });
        }

        private async Task<List<TrialBalanceRow>> BuildTrialBalanceRowsAsync(bool includeAdjusting)
        {
            var accounts = await _db.ChartOfAccounts
                .Where(a => a.IsActive)
                .OrderBy(a => a.ReferenceNumber)
                .ToListAsync();

            var accountIds = accounts.Select(a => a.Id).ToList();

            var linesQuery = _db.JournalEntryLines
                .Include(l => l.JournalEntry)
                .Where(l => accountIds.Contains(l.AccountId));

            var lines = includeAdjusting
                ? await linesQuery.Where(l => l.JournalEntry!.JournalType == "General" || l.JournalEntry!.JournalType == "Adjusting").ToListAsync()
                : await linesQuery.Where(l => l.JournalEntry!.JournalType == "General").ToListAsync();

            var rows = new List<TrialBalanceRow>();
            foreach (var account in accounts)
            {
                var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);
                var accountLines = lines.Where(l => l.AccountId == account.Id).ToList();
                var netBalance = normalDebit
                    ? accountLines.Sum(l => l.Debit - l.Credit)
                    : accountLines.Sum(l => l.Credit - l.Debit);

                // Akun tanpa mutasi sama sekali tidak perlu tampil di Neraca Saldo.
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

            var unadjusted = await BuildTrialBalanceRowsAsync(includeAdjusting: false);
            var adjusted = await BuildTrialBalanceRowsAsync(includeAdjusting: true);

            var accounts = await _db.ChartOfAccounts.Where(a => a.IsActive).OrderBy(a => a.ReferenceNumber).ToListAsync();

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

        // ==========================================================
        // INCOME STATEMENT
        // ==========================================================
        public async Task<IActionResult> IncomeStatement()
        {
            ViewData["Title"] = "Income Statement";
            var rows = await BuildTrialBalanceRowsAsync(includeAdjusting: true);
            var vm = BuildIncomeStatement(rows);
            return View(vm);
        }

        private IncomeStatementViewModel BuildIncomeStatement(List<TrialBalanceRow> rows)
        {
            var vm = new IncomeStatementViewModel { AsOfDate = DateTime.UtcNow };

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
            var vm = await BuildRetainedEarningsAsync();
            return View(vm);
        }

        private async Task<RetainedEarningsViewModel> BuildRetainedEarningsAsync()
        {
            var rows = await BuildTrialBalanceRowsAsync(includeAdjusting: true);
            var incomeStatement = BuildIncomeStatement(rows);
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
        // STATEMENT OF FINANCIAL POSITION (SOFP)
        // ==========================================================
        public async Task<IActionResult> StatementOfFinancialPosition()
        {
            ViewData["Title"] = "Statement of Financial Position";
            var vm = await BuildSofpAsync(isPostClosing: false);
            
            // Ditegaskan untuk me-render View "StatementOfFinancialPosition.cshtml"
            return View("StatementOfFinancialPosition", vm);
        }

        // ==========================================================
        // POST-CLOSING TRIAL BALANCE
        // ==========================================================
        public async Task<IActionResult> PostClosingTrialBalance()
        {
            ViewData["Title"] = "Post-Closing Trial Balance";
            var vm = await BuildSofpAsync(isPostClosing: true);
            
            // PERBAIKAN UTAMA: Menggunakan file view spesifik PostClosingTrialBalance.cshtml
            return View("PostClosingTrialBalance", vm);
        }

        private async Task<StatementOfFinancialPositionViewModel> BuildSofpAsync(bool isPostClosing)
        {
            var rows = await BuildTrialBalanceRowsAsync(includeAdjusting: true);
            var re = await BuildRetainedEarningsAsync();

            FinancialPositionLine ToLine(TrialBalanceRow r) => new()
            {
                ReferenceNumber = r.ReferenceNumber,
                AccountName = r.AccountName,
                Amount = r.NetBalance
            };

            var vm = new StatementOfFinancialPositionViewModel
            {
                AsOfDate = DateTime.UtcNow,
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

            var rows = await BuildTrialBalanceRowsAsync(includeAdjusting: true);
            var incomeStatement = BuildIncomeStatement(rows);
            var reAccountName = rows.FirstOrDefault(r => r.Role == "RetainedEarnings")?.AccountName ?? "Retained Earnings";

            var vm = new ClosingJournalViewModel
            {
                NetIncome = incomeStatement.NetIncome,
                RetainedEarningsAccountName = reAccountName
            };

            // Entri 1: tutup akun Pendapatan ke Retained Earnings
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

            // Entri 2: tutup akun Beban ke Retained Earnings
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

        // ==========================================================
        // CASH FLOW STATEMENT (Direct Method - IAS 7)
        // ==========================================================
        public async Task<IActionResult> CashFlowStatement()
        {
            ViewData["Title"] = "Cash Flow Statement";

            var cashAccountIds = await _db.ChartOfAccounts
                .Where(a => a.IsActive && a.Role == "CashAndEquivalents")
                .Select(a => a.Id)
                .ToListAsync();

            var vm = new CashFlowStatementViewModel { BeginningCash = 0 };

            if (!cashAccountIds.Any())
            {
                return View(vm);
            }

            var entryIds = await _db.JournalEntryLines
                .Where(l => cashAccountIds.Contains(l.AccountId))
                .Select(l => l.JournalEntryId)
                .Distinct()
                .ToListAsync();

            var entries = await _db.JournalEntries
                .Include(j => j.Lines)
                    .ThenInclude(l => l.Account)
                .Where(j => entryIds.Contains(j.Id))
                .ToListAsync();

            var operating = new Dictionary<string, decimal>();
            var investing = new Dictionary<string, decimal>();
            var financing = new Dictionary<string, decimal>();

            void Add(Dictionary<string, decimal> bucket, string description, decimal amount)
            {
                bucket[description] = bucket.GetValueOrDefault(description) + amount;
            }

            foreach (var entry in entries)
            {
                var cashLines = entry.Lines.Where(l => cashAccountIds.Contains(l.AccountId)).ToList();
                var cashNet = cashLines.Sum(l => l.Debit - l.Credit);
                if (cashNet == 0) continue;

                var contraLines = entry.Lines.Where(l => !cashAccountIds.Contains(l.AccountId)).ToList();
                var contraTotal = contraLines.Sum(l => Math.Abs(l.Debit - l.Credit));
                if (contraTotal == 0) continue;

                foreach (var contra in contraLines)
                {
                    var contraAmount = Math.Abs(contra.Debit - contra.Credit);
                    if (contraAmount == 0) continue;

                    var portion = cashNet * (contraAmount / contraTotal);
                    var type = contra.Account?.Type ?? "";
                    var description = contra.Account?.AccountName ?? "Uncategorized";

                    if (type == "OperatingIncome" || type == "OperatingExpenses" || type == "OtherIncome" || type == "OtherExpenses")
                    {
                        Add(operating, description, portion);
                    }
                    else if (type == "Liabilities")
                    {
                        Add(operating, description, portion);
                    }
                    else if (type == "Assets")
                    {
                        Add(investing, description, portion);
                    }
                    else if (type == "Equity")
                    {
                        Add(financing, description, portion);
                    }
                    else
                    {
                        Add(operating, description, portion);
                    }
                }
            }

            vm.OperatingActivities = operating.Select(kv => new CashFlowLine { Description = kv.Key, Amount = kv.Value }).OrderByDescending(l => l.Amount).ToList();
            vm.InvestingActivities = investing.Select(kv => new CashFlowLine { Description = kv.Key, Amount = kv.Value }).OrderByDescending(l => l.Amount).ToList();
            vm.FinancingActivities = financing.Select(kv => new CashFlowLine { Description = kv.Key, Amount = kv.Value }).OrderByDescending(l => l.Amount).ToList();

            return View(vm);
        }

        // Helper private untuk me-load data Ledger
        private async Task<List<LedgerAccountViewModel>> BuildLedgersAsync(Func<string, bool> typeFilter)
        {
            var accounts = (await _db.ChartOfAccounts
                    .Where(a => a.IsActive)
                    .OrderBy(a => a.ReferenceNumber)
                    .ToListAsync())
                .Where(a => typeFilter(a.Type))
                .ToList();

            var accountIds = accounts.Select(a => a.Id).ToList();

            var lines = await _db.JournalEntryLines
                .Include(l => l.JournalEntry)
                .Where(l => accountIds.Contains(l.AccountId))
                .OrderBy(l => l.JournalEntry!.EntryDate)
                .ThenBy(l => l.JournalEntry!.Id)
                .ThenBy(l => l.LineOrder)
                .ToListAsync();

            var result = new List<LedgerAccountViewModel>();

            foreach (var account in accounts)
            {
                var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);
                decimal running = 0;

                var ledgerLines = new List<LedgerLineViewModel>();
                foreach (var line in lines.Where(l => l.AccountId == account.Id))
                {
                    running += normalDebit ? (line.Debit - line.Credit) : (line.Credit - line.Debit);
                    ledgerLines.Add(new LedgerLineViewModel
                    {
                        EntryDate = line.JournalEntry!.EntryDate,
                        Description = line.LineDescription,
                        Debit = line.Debit,
                        Credit = line.Credit,
                        RunningBalance = running
                    });
                }

                result.Add(new LedgerAccountViewModel
                {
                    AccountId = account.Id,
                    ReferenceNumber = account.ReferenceNumber,
                    AccountName = account.AccountName,
                    Type = account.Type,
                    NormalBalanceIsDebit = normalDebit,
                    Lines = ledgerLines,
                    EndingBalance = running
                });
            }

            return result;
        }
    }
}
