using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
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
        public async Task<IActionResult> Create()
        {
            // Ambil daftar akun untuk dipilih di dropdown
            var accounts = await _context.ChartOfAccounts
                .OrderBy(a => a.AccountCode)
                .Select(a => new SelectListItem
                {
                    Value = a.Id.ToString(),
                    Text = $"{a.AccountCode} - {a.AccountName}"
                }).ToListAsync();

            ViewBag.Accounts = accounts;

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
                ViewBag.Accounts = new SelectList(await _context.ChartOfAccounts.OrderBy(a => a.AccountCode).ToListAsync(), "Id", "AccountName");
                return View(model);
            }

            // 1. Tentukan Tanggal Mulai (Selalu tanggal 1)
            var startDate = new DateTime(model.Year, model.Month, 1);
            var endDate = startDate.AddMonths(1).AddDays(-1);
            var periodName = startDate.ToString("MMMM yyyy");

            // 2. Validasi apakah periode sudah ada
            var periodExists = await _context.Periods.AnyAsync(p => p.StartDate == startDate);
            if (periodExists)
            {
                TempData["ErrorMessage"] = $"Period {periodName} already exists.";
                return RedirectToAction(nameof(Index));
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 3. Buat Periode Baru
                var newPeriod = new Period
                {
                    PeriodName = periodName,
                    StartDate = startDate,
                    EndDate = endDate,
                    IsClosed = false
                };
                _context.Periods.Add(newPeriod);
                await _context.SaveChangesAsync();

                // 4. Hitung Total Kredit (Retained Earnings)
                var totalOpeningBalance = model.CashBalance + model.BankBalance;

                // 5. Buat Jurnal Saldo Awal (Opening Balance)
                var journalEntry = new JournalEntry
                {
                    Date = startDate, // Selalu tanggal 1
                    Description = $"Opening Balance for {periodName}",
                    ReferenceNumber = $"OB-{startDate:yyyyMM}",
                    TotalDebit = totalOpeningBalance,
                    TotalCredit = totalOpeningBalance
                };
                _context.JournalEntries.Add(journalEntry);
                await _context.SaveChangesAsync();

                // 6. Masukkan Baris Jurnal (Lines)
                var lines = new List<JournalEntryLine>
                {
                    new JournalEntryLine { JournalEntryId = journalEntry.Id, AccountId = model.CashAccountId, Debit = model.CashBalance, Credit = 0 },
                    new JournalEntryLine { JournalEntryId = journalEntry.Id, AccountId = model.BankAccountId, Debit = model.BankBalance, Credit = 0 },
                    new JournalEntryLine { JournalEntryId = journalEntry.Id, AccountId = model.RetainedEarningsAccountId, Debit = 0, Credit = totalOpeningBalance }
                };

                _context.Set<JournalEntryLine>().AddRange(lines);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                TempData["SuccessMessage"] = $"Period {periodName} opened successfully with initial balances recorded.";
                return RedirectToAction(nameof(Index));
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                TempData["ErrorMessage"] = "A fatal error occurred while opening the period. Transaction rolled back.";
                return RedirectToAction(nameof(Index));
            }
        }
    }
}
