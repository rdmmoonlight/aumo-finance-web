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

        // Semua laporan di controller ini dibatasi ke:
        // 1. Data milik user yang sedang login (Chart of Accounts, Journal
        //    Entries terisolasi penuh per user).
        // 2. Periode yang sedang di-view (dipilih lewat ikon mata di halaman
        //    Periods). Tanpa periode terpilih, laporan kosong.
        private async Task<(Guid UserId, Period? Period)> GetReportContextAsync()
        {
            var userId = this.CurrentUserId();
            var period = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
            return (userId, period);
        }

        // ==========================================================
        // GENERAL LEDGER
        // ==========================================================

        // General Ledger: akun riil / permanen (Assets, Liabilities, Equity).
        public async Task<IActionResult> GeneralLedger()
        {
            ViewData["Title"] = "General Ledger";
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View(new List<LedgerAccountViewModel>());
            }
            ViewBag.SelectedPeriod = period;

            var ledgers = await BuildLedgersAsync(userId, period, AccountClassification.IsPermanent);
            return View(ledgers);
        }

        // General Ledger (Temporary Accounts): akun nominal / sementara
        // (Operating Income, Operating Expenses, Other Income, Other Expenses)
        public async Task<IActionResult> GeneralLedgerTemporary()
        {
            ViewData["Title"] = "General Ledger (Temporary Accounts)";
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View(new List<LedgerAccountViewModel>());
            }
            ViewBag.SelectedPeriod = period;

            var ledgers = await BuildLedgersAsync(userId, period, AccountClassification.IsTemporary);
            return View(ledgers);
        }

        // ==========================================================
        // TRIAL BALANCE / ADJUSTED TRIAL BALANCE
        // ==========================================================

        // Neraca Saldo (belum disesuaikan): hanya jurnal "General".
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

        // Neraca Saldo Disesuaikan: jurnal "General" + "Adjusting".
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

        // Membangun baris Neraca Saldo untuk SATU user, dibatasi ke periode
        // yang sedang di-view:
        // - Akun PERMANEN (Assets/Liabilities/Equity): kumulatif sampai akhir
        //   periode ini — saldo terbawa dari periode-periode sebelumnya.
        // - Akun NOMINAL (Income/Expense): hanya transaksi DALAM rentang
        //   tanggal periode ini — terisolasi, tidak terbawa ke periode lain.
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
        // STATEMENT OF FINANCIAL POSITION (SOFP)
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

            // Ditegaskan untuk me-render View "StatementOfFinancialPosition.cshtml"
            return View("StatementOfFinancialPosition", vm);
        }

        // ==========================================================
        // POST-CLOSING TRIAL BALANCE
        // ==========================================================
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

            // PERBAIKAN UTAMA: Menggunakan file view spesifik PostClosingTrialBalance.cshtml
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
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View(new CashFlowStatementViewModel { BeginningCash = 0 });
            }
            ViewBag.SelectedPeriod = period;

            var cashAccountIds = await _db.ChartOfAccounts
                .Where(a => a.IsActive && a.UserId == userId && a.Role == "CashAndEquivalents")
                .Select(a => a.Id)
                .ToListAsync();

            var vm = new CashFlowStatementViewModel { BeginningCash = 0 };

            if (!cashAccountIds.Any())
            {
                return View(vm);
            }

            // Arus kas hanya untuk transaksi DALAM periode yang sedang di-view.
            var entryIds = await _db.JournalEntryLines
                .Include(l => l.JournalEntry)
                .Where(l => cashAccountIds.Contains(l.AccountId)
                         && l.JournalEntry!.UserId == userId
                         && l.JournalEntry!.EntryDate >= period.StartDate && l.JournalEntry!.EntryDate <= period.EndDate)
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

        // Helper private untuk me-load data Ledger, dibatasi ke user +
        // periode yang sedang di-view (permanen = kumulatif s.d. akhir
        // periode, nominal = hanya dalam rentang periode).
        private async Task<List<LedgerAccountViewModel>> BuildLedgersAsync(Guid userId, Period period, Func<string, bool> typeFilter)
        {
            var accounts = (await _db.ChartOfAccounts
                    .Where(a => a.IsActive && a.UserId == userId)
                    .OrderBy(a => a.ReferenceNumber)
                    .ToListAsync())
                .Where(a => typeFilter(a.Type))
                .ToList();

            var accountIds = accounts.Select(a => a.Id).ToList();

            var lines = await _db.JournalEntryLines
                .Include(l => l.JournalEntry)
                .Where(l => accountIds.Contains(l.AccountId) && l.JournalEntry!.UserId == userId)
                .OrderBy(l => l.JournalEntry!.EntryDate)
                .ThenBy(l => l.JournalEntry!.Id)
                .ThenBy(l => l.LineOrder)
                .ToListAsync();

            var result = new List<LedgerAccountViewModel>();

            foreach (var account in accounts)
            {
                var isPermanent = AccountClassification.IsPermanent(account.Type);
                var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);
                decimal running = 0;

                var accountLines = isPermanent
                    ? lines.Where(l => l.AccountId == account.Id && l.JournalEntry!.EntryDate <= period.EndDate)
                    : lines.Where(l => l.AccountId == account.Id && l.JournalEntry!.EntryDate >= period.StartDate && l.JournalEntry!.EntryDate <= period.EndDate);

                var ledgerLines = new List<LedgerLineViewModel>();
                foreach (var line in accountLines)
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
