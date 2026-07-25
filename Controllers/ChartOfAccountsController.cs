using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AurumFinance.Models;

namespace AurumFinance.Controllers
{
    public class ChartOfAccountsController : Controller
    {
        private readonly AppDbContext _db;

        public ChartOfAccountsController(AppDbContext db)
        {
            _db = db;
        }

        public async Task<IActionResult> Index()
        {
            var accounts = await _db.ChartOfAccounts
                .OrderBy(a => a.ReferenceNumber)
                .ToListAsync();

            // Saldo tidak disimpan; dihitung langsung dari JournalEntryLine
            // (General Ledger) supaya selalu konsisten dengan Journal Entry
            // dan General Journal.
            var accountIds = accounts.Select(a => a.Id).ToList();
            var totalsByAccount = await _db.JournalEntryLines
                .Where(l => accountIds.Contains(l.AccountId))
                .GroupBy(l => l.AccountId)
                .Select(g => new { AccountId = g.Key, Debit = g.Sum(l => l.Debit), Credit = g.Sum(l => l.Credit) })
                .ToDictionaryAsync(g => g.AccountId);

            foreach (var account in accounts)
            {
                totalsByAccount.TryGetValue(account.Id, out var totals);
                var debit = totals?.Debit ?? 0m;
                var credit = totals?.Credit ?? 0m;
                account.Balance = AccountClassification.NormalBalanceIsDebit(account.Type)
                    ? debit - credit
                    : credit - debit;
            }

            return View(accounts);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(ChartOfAccount model)
        {
            if (!ModelState.IsValid)
            {
                TempData["ErrorMessage"] = "Invalid data submitted. Please check your inputs.";
                return RedirectToAction(nameof(Index));
            }

            // Validation: Ensure the reference number falls within the correct category range
            if (!AccountClassification.ValidateReferenceNumber(model.Type, model.ReferenceNumber))
            {
                TempData["ErrorMessage"] = $"Failed: The reference number {model.ReferenceNumber} is invalid for the '{model.Type}' category.";
                return RedirectToAction(nameof(Index));
            }

            // Validation: Prevent duplicate reference numbers
            if (await _db.ChartOfAccounts.AnyAsync(a => a.ReferenceNumber == model.ReferenceNumber))
            {
                TempData["ErrorMessage"] = $"Failed: Reference number {model.ReferenceNumber} is already in use.";
                return RedirectToAction(nameof(Index));
            }

            model.Id = 0;
            model.IsActive = true;
            _db.ChartOfAccounts.Add(model);
            await _db.SaveChangesAsync();

            TempData["SuccessMessage"] = $"Account '{model.AccountName}' has been successfully created.";
            return RedirectToAction(nameof(Index));
        }
    }
}
