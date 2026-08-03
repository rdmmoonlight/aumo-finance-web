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
            var userId = this.CurrentUserId();

            var periods = await _context.Periods
                                        .Where(p => p.UserId == userId)
                                        .OrderByDescending(p => p.StartDate)
                                        .ToListAsync();

            ViewBag.SelectedPeriodId = (await SelectedPeriodHelper.GetSelectedPeriodAsync(_context, userId))?.Id;

            return View(periods);
        }

        // GET: /Periods/SelectPeriod/{id}
        public async Task<IActionResult> SelectPeriod(int id)
        {
            var userId = this.CurrentUserId();
            var period = await _context.Periods.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
            if (period == null)
            {
                TempData["ErrorMessage"] = "Period not found.";
                return RedirectToAction(nameof(Index));
            }

            await SelectedPeriodHelper.SelectPeriodAsync(_context, userId, period.Id);
            TempData["SuccessMessage"] = $"Now viewing {period.PeriodName}" + (period.IsClosed ? " (Closed)." : ".");
            return RedirectToAction(nameof(Index));
        }

        // GET: /Periods/ClearSelection
        public async Task<IActionResult> ClearSelection()
        {
            var userId = this.CurrentUserId();
            await SelectedPeriodHelper.ClearSelectionAsync(_context, userId);
            TempData["SuccessMessage"] = "No period selected. Reports and journals are hidden until you view a period.";
            return RedirectToAction(nameof(Index));
        }

        // GET: /Periods/Create
        public async Task<IActionResult> Create()
        {
            var userId = this.CurrentUserId();
            var model = new OpenPeriodViewModel
            {
                Month = DateTime.Today.Month,
                Year = DateTime.Today.Year
            };

            await PopulateReferenceDataAsync(model, userId);
            model.SetupMode = model.HasExistingPermanentAccounts
                ? OpenPeriodViewModel.ModeLoadExisting
                : OpenPeriodViewModel.ModeCreateNew;

            return View(model);
        }

        private async Task PopulateReferenceDataAsync(OpenPeriodViewModel model, Guid userId)
        {
            var accounts = await _context.ChartOfAccounts
                .Where(a => a.IsActive && a.UserId == userId)
                .OrderBy(a => a.ReferenceNumber)
                .ToListAsync();

            // Khusus mengambil akun permanen / riil (Assets, Liabilities, Equity)
            model.PermanentAccounts = accounts
                .Where(a => a.Type == "Assets" || a.Type == "Liabilities" || a.Type == "Equity")
                .ToList();

            model.AvailableCashAndBankAccounts = accounts.Where(a => a.Role == "CashAndEquivalents").ToList();
            model.AvailableRetainedEarningsAccounts = accounts.Where(a => a.Role == "RetainedEarnings").ToList();
            model.HasExistingPermanentAccounts = model.AvailableCashAndBankAccounts.Any() && model.AvailableRetainedEarningsAccounts.Any();

            // Auto-select akun default jika belum ada pilihan di model
            if (model.HasExistingPermanentAccounts)
            {
                if (model.CashAccountId == null)
                {
                    model.CashAccountId = model.AvailableCashAndBankAccounts.FirstOrDefault()?.Id;
                }

                if (model.BankAccountId == null)
                {
                    // Ambil opsi akun bank berbeda jika memungkinkan
                    model.BankAccountId = model.AvailableCashAndBankAccounts.Skip(1).FirstOrDefault()?.Id
                                        ?? model.AvailableCashAndBankAccounts.FirstOrDefault()?.Id;
                }

                if (model.RetainedEarningsAccountId == null)
                {
                    model.RetainedEarningsAccountId = model.AvailableRetainedEarningsAccounts.FirstOrDefault()?.Id;
                }

                // Isi nilai awal properti model dari akun yang terpilih
                var selectedCash = model.AvailableCashAndBankAccounts.FirstOrDefault(a => a.Id == model.CashAccountId);
                if (selectedCash != null && string.IsNullOrEmpty(model.CashAccountCode))
                {
                    model.CashAccountCode = selectedCash.ReferenceNumber.ToString();
                    model.CashAccountName = selectedCash.AccountName;
                }

                var selectedBank = model.AvailableCashAndBankAccounts.FirstOrDefault(a => a.Id == model.BankAccountId);
                if (selectedBank != null && string.IsNullOrEmpty(model.BankAccountCode))
                {
                    model.BankAccountCode = selectedBank.ReferenceNumber.ToString();
                    model.BankAccountName = selectedBank.AccountName;
                }

                var selectedRetained = model.AvailableRetainedEarningsAccounts.FirstOrDefault(a => a.Id == model.RetainedEarningsAccountId);
                if (selectedRetained != null && string.IsNullOrEmpty(model.RetainedEarningsAccountCode))
                {
                    model.RetainedEarningsAccountCode = selectedRetained.ReferenceNumber.ToString();
                    model.RetainedEarningsAccountName = selectedRetained.AccountName;
                }
            }
        }

        // POST: /Periods/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(OpenPeriodViewModel model)
        {
            var userId = this.CurrentUserId();

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
                startDate = new DateTime(model.Year, model.Month, 1, 0, 0, 0, DateTimeKind.Utc);
                endDate = startDate.AddMonths(1).AddDays(-1);
                periodName = startDate.ToString("MMMM yyyy");

                var periodExists = await _context.Periods.AnyAsync(p => p.UserId == userId && p.StartDate == startDate);
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
                await PopulateReferenceDataAsync(model, userId);
                return View(model);
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                if (isLoadExisting)
                {
                    var cashAccount = await _context.ChartOfAccounts.FirstOrDefaultAsync(a => a.Id == model.CashAccountId && a.UserId == userId);
                    var bankAccount = await _context.ChartOfAccounts.FirstOrDefaultAsync(a => a.Id == model.BankAccountId && a.UserId == userId);
                    var retainedAccount = await _context.ChartOfAccounts.FirstOrDefaultAsync(a => a.Id == model.RetainedEarningsAccountId && a.UserId == userId);

                    if (cashAccount == null || bankAccount == null || retainedAccount == null)
                    {
                        await transaction.RollbackAsync();
                        ModelState.AddModelError(string.Empty, "One or more selected accounts could not be found.");
                        await PopulateReferenceDataAsync(model, userId);
                        return View(model);
                    }

                    var newPeriod = new Period
                    {
                        UserId = userId,
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
                        .Where(a => a.UserId == userId
                                 && (a.ReferenceNumber.ToString() == model.CashAccountCode
                                 || a.ReferenceNumber.ToString() == model.BankAccountCode
                                 || a.ReferenceNumber.ToString() == model.RetainedEarningsAccountCode))
                        .Select(a => a.ReferenceNumber)
                        .ToListAsync();

                    if (existingCodes.Any())
                    {
                        await transaction.RollbackAsync();
                        ModelState.AddModelError(string.Empty, "One or more account reference numbers are already in use in your Chart of Accounts.");
                        await PopulateReferenceDataAsync(model, userId);
                        return View(model);
                    }

                    var cashAccount = new ChartOfAccount { UserId = userId, ReferenceNumber = int.Parse(model.CashAccountCode!), AccountName = model.CashAccountName!, Type = "Assets", Role = "CashAndEquivalents", IsActive = true };
                    var bankAccount = new ChartOfAccount { UserId = userId, ReferenceNumber = int.Parse(model.BankAccountCode!), AccountName = model.BankAccountName!, Type = "Assets", Role = "CashAndEquivalents", IsActive = true };
                    var retainedAccount = new ChartOfAccount { UserId = userId, ReferenceNumber = int.Parse(model.RetainedEarningsAccountCode!), AccountName = model.RetainedEarningsAccountName!, Type = "Equity", Role = "RetainedEarnings", IsActive = true };

                    _context.ChartOfAccounts.AddRange(cashAccount, bankAccount, retainedAccount);
                    await _context.SaveChangesAsync();

                    var newPeriod = new Period
                    {
                        UserId = userId,
                        PeriodName = periodName,
                        StartDate = startDate,
                        EndDate = endDate,
                        IsClosed = false
                    };
                    _context.Periods.Add(newPeriod);
                    await _context.SaveChangesAsync();

                    var cashBalance = model.CashBalance ?? 0;
                    var bankBalance = model.BankBalance ?? 0;
                    var totalOpeningBalance = cashBalance + bankBalance;
                    var journalEntry = new JournalEntry
                    {
                        UserId = userId,
                        ReferenceNumber = $"GJ-OPEN-{startDate:yyyyMM}",
                        EntryDate = startDate,
                        JournalType = "General"
                    };
                    _context.JournalEntries.Add(journalEntry);
                    await _context.SaveChangesAsync();

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
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ClosePeriod(int id)
        {
            var userId = this.CurrentUserId();
            var period = await _context.Periods.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
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

            var hasEarlierOpenPeriod = await _context.Periods
                .AnyAsync(p => p.UserId == userId && p.Id != period.Id && p.StartDate < period.StartDate && !p.IsClosed);

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
