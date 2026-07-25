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

        // GET: /Periods/Create
        public IActionResult Create()
        {
            // Tidak perlu lagi memanggil ViewBag.Accounts karena input manual
            var model = new OpenPeriodViewModel
            {
                Month = DateTime.Today.Month,
                Year = DateTime.Today.Year
            };

            return View(model);
        }

        // POST: /Periods/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(OpenPeriodViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var startDate = new DateTime(model.Year, model.Month, 1);
            var endDate = startDate.AddMonths(1).AddDays(-1);
            var periodName = startDate.ToString("MMMM yyyy");

            var periodExists = await _context.Periods.AnyAsync(p => p.StartDate == startDate);
            if (periodExists)
            {
                TempData["ErrorMessage"] = $"Period {periodName} already exists.";
                return RedirectToAction(nameof(Index));
            }

            // Validasi tambahan: Pastikan kode akun belum dipakai di COA
            var existingCodes = await _context.ChartOfAccounts
                .Where(a => a.AccountCode == model.CashAccountCode 
                         || a.AccountCode == model.BankAccountCode 
                         || a.AccountCode == model.RetainedEarningsAccountCode)
                .Select(a => a.AccountCode)
                .ToListAsync();

            if (existingCodes.Any())
            {
                ModelState.AddModelError(string.Empty, $"Account Code(s) already exist in COA: {string.Join(", ", existingCodes)}");
                return View(model);
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Buat 3 Akun Baru di COA
                var cashAccount = new ChartOfAccount { AccountCode = model.CashAccountCode, AccountName = model.CashAccountName };
                var bankAccount = new ChartOfAccount { AccountCode = model.BankAccountCode, AccountName = model.BankAccountName };
                var retainedAccount = new ChartOfAccount { AccountCode = model.RetainedEarningsAccountCode, AccountName = model.RetainedEarningsAccountName };
                
                // (Catatan: Jika Model ChartOfAccount kamu wajib punya AccountClassificationId, tambahkan di sini)
                
                _context.ChartOfAccounts.AddRange(cashAccount, bankAccount, retainedAccount);
                await _context.SaveChangesAsync(); // Save agar mendapatkan ID

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
                var totalOpeningBalance = model.CashBalance + model.BankBalance;
                var journalEntry = new JournalEntry
                {
                    Date = startDate,
                    Description = $"Opening Balance for {periodName}",
                    ReferenceNumber = $"OB-{startDate:yyyyMM}",
                    TotalDebit = totalOpeningBalance,
                    TotalCredit = totalOpeningBalance
                };
                _context.JournalEntries.Add(journalEntry);
                await _context.SaveChangesAsync();

                // 4. Masukkan Baris Jurnal dengan ID Akun yang baru terbuat
                var lines = new List<JournalEntryLine>
                {
                    new JournalEntryLine { JournalEntryId = journalEntry.Id, AccountId = cashAccount.Id, Debit = model.CashBalance, Credit = 0 },
                    new JournalEntryLine { JournalEntryId = journalEntry.Id, AccountId = bankAccount.Id, Debit = model.BankBalance, Credit = 0 },
                    new JournalEntryLine { JournalEntryId = journalEntry.Id, AccountId = retainedAccount.Id, Debit = 0, Credit = totalOpeningBalance }
                };

                _context.Set<JournalEntryLine>().AddRange(lines);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                TempData["SuccessMessage"] = $"Period {periodName} opened. Core accounts created and initial balances recorded.";
                return RedirectToAction(nameof(Index));
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                TempData["ErrorMessage"] = "A fatal error occurred while processing. Transaction rolled back.";
                return RedirectToAction(nameof(Index));
            }
        }
    }
}
