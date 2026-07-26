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

            // Gunakan DateTimeKind.Utc agar diterima secara mutlak oleh PostgreSQL
            var startDate = new DateTime(model.Year, model.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var endDate = startDate.AddMonths(1).AddDays(-1);
            var periodName = startDate.ToString("MMMM yyyy");

            var periodExists = await _context.Periods.AnyAsync(p => p.StartDate == startDate);
            if (periodExists)
            {
                TempData["ErrorMessage"] = $"Period {periodName} already exists.";
                return RedirectToAction(nameof(Index));
            }

            var existingCodes = await _context.ChartOfAccounts
                .Where(a => a.ReferenceNumber.ToString() == model.CashAccountCode 
                         || a.ReferenceNumber.ToString() == model.BankAccountCode 
                         || a.ReferenceNumber.ToString() == model.RetainedEarningsAccountCode)
                .Select(a => a.ReferenceNumber)
                .ToListAsync();

            if (existingCodes.Any())
            {
                ModelState.AddModelError(string.Empty, "One or more account reference numbers are already in use in the Chart of Accounts.");
                return View(model);
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Buat 3 Akun Baru di COA
                var cashAccount = new ChartOfAccount { ReferenceNumber = int.Parse(model.CashAccountCode), AccountName = model.CashAccountName, Type = "Assets", Role = "CashAndEquivalents", IsActive = true };
                var bankAccount = new ChartOfAccount { ReferenceNumber = int.Parse(model.BankAccountCode), AccountName = model.BankAccountName, Type = "Assets", Role = "CashAndEquivalents", IsActive = true };
                var retainedAccount = new ChartOfAccount { ReferenceNumber = int.Parse(model.RetainedEarningsAccountCode), AccountName = model.RetainedEarningsAccountName, Type = "Equity", Role = "RetainedEarnings", IsActive = true };
                
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
                var totalOpeningBalance = model.CashBalance + model.BankBalance;
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
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                TempData["ErrorMessage"] = $"Transaction failed: {ex.InnerException?.Message ?? ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }
    }
}
