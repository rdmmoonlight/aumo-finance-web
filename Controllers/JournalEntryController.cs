using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public class JournalEntryController : Controller
    {
        private readonly AppDbContext _db;

        public JournalEntryController(AppDbContext db)
        {
            _db = db;
        }

        // Route: /JournalEntry/Create
        public async Task<IActionResult> Create()
        {
            ViewData["Title"] = "New Journal Entry";

            var model = new JournalEntryCreateViewModel
            {
                EntryDate = DateTime.Today,
                AvailableAccounts = await ActiveAccountsAsync()
            };

            return View(model);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(JournalEntryCreateViewModel model)
        {
            // Buang baris kosong (akun belum dipilih dan debit/kredit nol)
            model.Lines = model.Lines
                .Where(l => l.AccountId != 0 && (l.Debit != 0 || l.Credit != 0))
                .ToList();

            if (model.Lines.Count < 2)
            {
                ModelState.AddModelError(string.Empty, "A journal entry must have at least two line items.");
            }

            var totalDebit = model.Lines.Sum(l => l.Debit);
            var totalCredit = model.Lines.Sum(l => l.Credit);

            if (totalDebit != totalCredit || totalDebit == 0)
            {
                ModelState.AddModelError(string.Empty, "Total debit must equal total credit before posting.");
            }

            var validAccountIds = (await _db.ChartOfAccounts.Where(a => a.IsActive).Select(a => a.Id).ToListAsync())
                .ToHashSet();
            if (model.Lines.Any(l => !validAccountIds.Contains(l.AccountId)))
            {
                ModelState.AddModelError(string.Empty, "One or more selected accounts are invalid or inactive.");
            }

            if (!ModelState.IsValid)
            {
                model.AvailableAccounts = await ActiveAccountsAsync();
                return View(model);
            }

            var entry = new JournalEntry
            {
                JournalType = model.JournalType,
                EntryDate = model.EntryDate,
                Lines = model.Lines.Select((l, index) => new JournalEntryLine
                {
                    AccountId = l.AccountId,
                    LineDescription = l.LineDescription,
                    Debit = l.Debit,
                    Credit = l.Credit,
                    LineOrder = index
                }).ToList()
            };

            _db.JournalEntries.Add(entry);
            await _db.SaveChangesAsync();

            TempData["SuccessMessage"] = "Journal entry has been posted.";
            return RedirectToAction("Index", "GeneralJournal");
        }

        private async Task<List<ChartOfAccount>> ActiveAccountsAsync()
        {
            return await _db.ChartOfAccounts
                .Where(a => a.IsActive)
                .OrderBy(a => a.ReferenceNumber)
                .ToListAsync();
        }
    }
}
