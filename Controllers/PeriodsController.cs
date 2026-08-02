using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public class PeriodsController : Controller
    {
        private readonly AppDbContext _context;

        public PeriodsController(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IActionResult> Index()
        {
            var periods = await _context.Periods
                                        .OrderByDescending(p => p.StartDate)
                                        .ToListAsync();
            return View(periods);
        }

        // GET: /Periods/Details/{id}
        // Satu-satunya jalan untuk membaca kembali transaksi milik periode
        // yang sudah ditutup. Menampilkan seluruh jurnal (General + Adjusting)
        // bertanggal di rentang periode ini, terlepas dari status IsClosed.
        public async Task<IActionResult> Details(int id)
        {
            var period = await _context.Periods.FindAsync(id);
            if (period == null)
            {
                TempData["ErrorMessage"] = "Period not found.";
                return RedirectToAction(nameof(Index));
            }

            var entries = await _context.JournalEntries
                .Include(j => j.Lines)
                    .ThenInclude(l => l.Account)
                .Where(j => j.EntryDate >= period.StartDate && j.EntryDate <= period.EndDate)
                .OrderBy(j => j.EntryDate)
                .ThenBy(j => j.Id)
                .ToListAsync();

            ViewData["Title"] = $"Period Details - {period.PeriodName}";
            ViewBag.Period = period;

            return View(entries);
        }

        // GET: /Periods/Create
        public async Task<IActionResult> Create()
        {
            var model = new OpenPeriodViewModel
            {
                Month = DateTime.Today.Month,
                Year = DateTime.Today.Year
            };

            await PopulateReferenceDataAsync(model);
            model.SetupMode = model.HasExistingPermanentAccounts
                ? OpenPeriodViewModel.ModeLoadExisting
                : OpenPeriodViewModel.ModeCreateNew;

            return View(model);
        }

        private async Task PopulateReferenceDataAsync(OpenPeriodViewModel model)
        {
            var accounts = await _context.ChartOfAccounts
                .Where(a => a.IsActive)
                .OrderBy(a => a.ReferenceNumber)
                .ToListAsync();

            model.ExistingAccounts = accounts;
            model.AvailableCashAndBankAccounts = accounts.Where(a => a.Role == "CashAndEquivalents").ToList();
            model.AvailableRetainedEarningsAccounts = accounts.Where(a => a.Role == "RetainedEarnings").ToList();
            model.HasExistingPermanentAccounts = model.AvailableCashAndBankAccounts.Any() && model.AvailableRetainedEarningsAccounts.Any();
        }

        // POST: /Periods/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(OpenPeriodViewModel model)
        {
            if (model.Month < 1 || model.Month > 12)
            {
                ModelState.AddModelError(nameof(model.Month), "Please select a valid month.");
            }
            if (model.Year < 2000 || model.Year > 2100)
            {
                ModelState.AddModelError(nameof(model.Year), "Please provide a valid year.");
            }

            var startDate = default(DateTime);
            var endDate = default(DateTime);
            var periodName = string.Empty;

            if (ModelState.IsValid)
            {
                // Gunakan DateTimeKind.Utc agar diterima secara mutlak oleh PostgreSQL
                startDate = new DateTime(model.Year, model.Month, 1, 0, 0, 0, DateTimeKind.Utc);
                endDate = startDate.AddMonths(1).AddDays(-1);
                periodName = startDate.ToString("MMMM yyyy");

                var periodExists = await _context.Periods.AnyAsync(p => p.StartDate == startDate);
                if (periodExists)
                {
                    ModelState.AddModelError(string.Empty, $"Period {periodName} already exists.");
                }
            }

            var isLoadExisting = model.SetupMode == OpenPeriodViewModel.ModeLoadExisting;

            if (isLoadExisting)
            {
                if (model.CashAccountId == null || model.BankAccountId == null || model.RetainedEarningsAccountId == null)
                {
                    ModelState.AddModelError(string.Empty, "Please select the Cash, Bank, and Retained Earnings accounts to carry forward.");
                }
                else if (model.CashAccountId == model.BankAccountId)
                {
                    ModelState.AddModelError(string.Empty, "Cash Account and Bank Account cannot be the same account.");
                }
            }
            else
            {
                if (string.IsNullOrWhiteSpace(model.CashAccountCode) || string.IsNullOrWhiteSpace(model.CashAccountName) ||
                    string.IsNullOrWhiteSpace(model.BankAccountCode) || string.IsNullOrWhiteSpace(model.BankAccountName) ||
                    string.IsNullOrWhiteSpace(model.RetainedEarningsAccountCode) || string.IsNullOrWhiteSpace(model.RetainedEarningsAccountName))
                {
                    ModelState.AddModelError(string.Empty, "Please complete all new account fields (reference code & name).");
                }
            }

            if (!ModelState.IsValid)
            {
                await PopulateReferenceDataAsync(model);
                return View(model);
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                if (isLoadExisting)
                {
                    var cashAccount = await _context.ChartOfAccounts.FindAsync(model.CashAccountId);
                    var bankAccount = await _context.ChartOfAccounts.FindAsync(model.BankAccountId);
                    var retainedAccount = await _context.ChartOfAccounts.FindAsync(model.RetainedEarningsAccountId);

                    if (cashAccount == null || bankAccount == null || retainedAccount == null)
                    {
                        await transaction.RollbackAsync();
                        ModelState.AddModelError(string.Empty, "One or more selected accounts could not be found.");
                        await PopulateReferenceDataAsync(model);
                        return View(model);
                    }

                    // Tidak perlu membuat akun baru ataupun jurnal saldo awal:
                    // ledger tidak di-reset per periode, jadi saldo akun
                    // permanen otomatis lanjut dari periode sebelumnya.
                    var newPeriod = new Period
                    {
                        PeriodName = periodName,
                        StartDate = startDate,
                        EndDate = endDate,
                        IsClosed = false
                    };
                    _context.Periods.Add(newPeriod);
                    await _context.SaveChangesAsync();

                    await transaction.CommitAsync();
                    TempData["SuccessMessage"] = $"Period {periodName} opened using existing accounts ({cashAccount.AccountName}, {bankAccount.AccountName}, {retainedAccount.AccountName}). Balances carry forward automatically.";
                    return RedirectToAction(nameof(Index));
                }
                else
                {
                    var existingCodes = await _context.ChartOfAccounts
                        .Where(a => a.ReferenceNumber.ToString() == model.CashAccountCode
                                 || a.ReferenceNumber.ToString() == model.BankAccountCode
                                 || a.ReferenceNumber.ToString() == model.RetainedEarningsAccountCode)
                        .Select(a => a.ReferenceNumber)
                        .ToListAsync();

                    if (existingCodes.Any())
                    {
                        await transaction.RollbackAsync();
                        ModelState.AddModelError(string.Empty, "One or more account reference numbers are already in use in the Chart of Accounts.");
                        await PopulateReferenceDataAsync(model);
                        return View(model);
                    }

                    // 1. Buat 3 Akun Baru di COA
                    var cashAccount = new ChartOfAccount { ReferenceNumber = int.Parse(model.CashAccountCode!), AccountName = model.CashAccountName!, Type = "Assets", Role = "CashAndEquivalents", IsActive = true };
                    var bankAccount = new ChartOfAccount { ReferenceNumber = int.Parse(model.BankAccountCode!), AccountName = model.BankAccountName!, Type = "Assets", Role = "CashAndEquivalents", IsActive = true };
                    var retainedAccount = new ChartOfAccount { ReferenceNumber = int.Parse(model.RetainedEarningsAccountCode!), AccountName = model.RetainedEarningsAccountName!, Type = "Equity", Role = "RetainedEarnings", IsActive = true };

                    _context.ChartOfAccounts.AddRange(cashAccount, bankAccount, retainedAccount);
                    await _context.SaveChangesAsync();

                    // 2. Buat Periode Baru
                    var newPeriod = new Period
                    {
                        PeriodName = periodName,
                        StartDate = startDate,
                        EndDate = endDate,
                        IsClosed = false
                    };
                    _context.Periods.Add(newPeriod);
                    await _context.SaveChangesAsync();

                    // 3. Jurnal Saldo Awal
                    var cashBalance = model.CashBalance ?? 0;
                    var bankBalance = model.BankBalance ?? 0;
                    var totalOpeningBalance = cashBalance + bankBalance;
                    var journalEntry = new JournalEntry
                    {
                        EntryDate = startDate,
                        JournalType = "General"
                    };
                    _context.JournalEntries.Add(journalEntry);
                    await _context.SaveChangesAsync();

                    // 4. Masukkan Baris Jurnal
                    var lines = new List<JournalEntryLine>
                    {
                        new JournalEntryLine { JournalEntryId = journalEntry.Id, AccountId = cashAccount.Id, Debit = cashBalance, Credit = 0 },
                        new JournalEntryLine { JournalEntryId = journalEntry.Id, AccountId = bankAccount.Id, Debit = bankBalance, Credit = 0 },
                        new JournalEntryLine { JournalEntryId = journalEntry.Id, AccountId = retainedAccount.Id, Debit = 0, Credit = totalOpeningBalance }
                    };

                    _context.Set<JournalEntryLine>().AddRange(lines);
                    await _context.SaveChangesAsync();

                    await transaction.CommitAsync();
                    TempData["SuccessMessage"] = $"Period {periodName} opened. New permanent accounts created and initial balances recorded.";
                    return RedirectToAction(nameof(Index));
                }
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                TempData["ErrorMessage"] = $"Transaction failed: {ex.InnerException?.Message ?? ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }

        // POST: /Periods/ClosePeriod/{id}
        // Fungsi close period satu-satunya di aplikasi ini. Menutup periode
        // mengunci periode tersebut dari perubahan lebih lanjut. Retained
        // Earnings dan Laporan Posisi Keuangan tetap dihitung langsung dari
        // saldo akun nominal (lihat ReportsController), bukan lewat jurnal
        // penutup yang disimpan ke database.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ClosePeriod(int id)
        {
            var period = await _context.Periods.FindAsync(id);
            if (period == null)
            {
                TempData["ErrorMessage"] = "Period not found.";
                return RedirectToAction(nameof(Index));
            }

            if (period.IsClosed)
            {
                TempData["ErrorMessage"] = $"Period {period.PeriodName} is already closed.";
                return RedirectToAction(nameof(Index));
            }

            // Periode harus ditutup berurutan: periode dengan StartDate lebih
            // awal wajib sudah ditutup lebih dulu, supaya integritas historis
            // ledger terjaga.
            var hasEarlierOpenPeriod = await _context.Periods
                .AnyAsync(p => p.Id != period.Id && p.StartDate < period.StartDate && !p.IsClosed);

            if (hasEarlierOpenPeriod)
            {
                TempData["ErrorMessage"] = $"Cannot close {period.PeriodName}: an earlier period is still open. Close earlier periods first.";
                return RedirectToAction(nameof(Index));
            }

            period.IsClosed = true;
            await _context.SaveChangesAsync();

            TempData["SuccessMessage"] = $"Period {period.PeriodName} has been closed. Transactions in this period are now locked.";
            return RedirectToAction(nameof(Index));
        }
    }
}
