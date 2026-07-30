using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    // Halaman admin untuk mengklasifikasikan transaksi cepat yang masuk
    // lewat Android (Source == "Mobile", NeedsClassification == true) ke
    // akun pendapatan/beban yang sesuai di Chart of Accounts.
    public class MobileClassificationController : Controller
    {
        private readonly AppDbContext _context;

        public MobileClassificationController(AppDbContext context)
        {
            _context = context;
        }

        // GET: /MobileClassification
        public async Task<IActionResult> Index()
        {
            var entries = await _context.JournalEntries
                .Include(e => e.Lines)
                    .ThenInclude(l => l.Account)
                .Where(e => e.NeedsClassification && e.Source == "Mobile")
                .OrderByDescending(e => e.EntryDate)
                .ThenByDescending(e => e.Id)
                .ToListAsync();

            var list = new List<MobileClassificationListItem>();
            foreach (var entry in entries)
            {
                var unclassifiedLine = entry.Lines
                    .FirstOrDefault(l => l.Account != null &&
                        (l.Account.Role == "UnclassifiedIncome" || l.Account.Role == "UnclassifiedExpense"));

                if (unclassifiedLine == null)
                {
                    // Data tidak konsisten (mis. sudah pernah diedit manual); lewati.
                    continue;
                }

                var isIncome = unclassifiedLine.Account!.Role == "UnclassifiedIncome";

                list.Add(new MobileClassificationListItem
                {
                    JournalEntryId = entry.Id,
                    ReferenceNumber = entry.ReferenceNumber,
                    EntryDate = entry.EntryDate,
                    Type = isIncome ? "Income" : "Expense",
                    Amount = isIncome ? unclassifiedLine.Credit : unclassifiedLine.Debit,
                    MobileNote = entry.MobileNote
                });
            }

            return View(list);
        }

        // GET: /MobileClassification/Classify/5
        public async Task<IActionResult> Classify(int id)
        {
            var entry = await _context.JournalEntries
                .Include(e => e.Lines)
                    .ThenInclude(l => l.Account)
                .FirstOrDefaultAsync(e => e.Id == id && e.NeedsClassification && e.Source == "Mobile");

            if (entry == null)
            {
                TempData["ErrorMessage"] = "Transaksi tidak ditemukan atau sudah diklasifikasikan.";
                return RedirectToAction(nameof(Index));
            }

            var unclassifiedLine = entry.Lines
                .FirstOrDefault(l => l.Account != null &&
                    (l.Account.Role == "UnclassifiedIncome" || l.Account.Role == "UnclassifiedExpense"));

            if (unclassifiedLine == null)
            {
                TempData["ErrorMessage"] = "Transaksi ini tidak memiliki baris Unclassified yang valid.";
                return RedirectToAction(nameof(Index));
            }

            var isIncome = unclassifiedLine.Account!.Role == "UnclassifiedIncome";

            var vm = new MobileClassifyViewModel
            {
                JournalEntryId = entry.Id,
                ReferenceNumber = entry.ReferenceNumber,
                EntryDate = entry.EntryDate,
                Type = isIncome ? "Income" : "Expense",
                Amount = isIncome ? unclassifiedLine.Credit : unclassifiedLine.Debit,
                MobileNote = entry.MobileNote,
                UnclassifiedLineId = unclassifiedLine.Id,
                Description = entry.MobileNote,
                AvailableAccounts = await GetEligibleAccountsAsync(isIncome)
            };

            return View(vm);
        }

        // POST: /MobileClassification/Classify/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Classify(int id, MobileClassifyViewModel model)
        {
            var entry = await _context.JournalEntries
                .Include(e => e.Lines)
                    .ThenInclude(l => l.Account)
                .FirstOrDefaultAsync(e => e.Id == id && e.NeedsClassification && e.Source == "Mobile");

            if (entry == null)
            {
                TempData["ErrorMessage"] = "Transaksi tidak ditemukan atau sudah diklasifikasikan.";
                return RedirectToAction(nameof(Index));
            }

            var line = entry.Lines.FirstOrDefault(l => l.Id == model.UnclassifiedLineId);
            if (line == null || line.Account == null)
            {
                TempData["ErrorMessage"] = "Baris jurnal yang akan diklasifikasikan tidak valid.";
                return RedirectToAction(nameof(Index));
            }

            var isIncome = line.Account.Role == "UnclassifiedIncome";

            var eligible = await GetEligibleAccountsAsync(isIncome);
            var chosen = eligible.FirstOrDefault(a => a.Id == model.SelectedAccountId);

            if (chosen == null)
            {
                TempData["ErrorMessage"] = "Akun yang dipilih tidak valid untuk jenis transaksi ini.";
                return RedirectToAction(nameof(Classify), new { id });
            }

            line.AccountId = chosen.Id;
            if (!string.IsNullOrWhiteSpace(model.Description))
            {
                line.LineDescription = model.Description;
            }

            entry.NeedsClassification = false;

            await _context.SaveChangesAsync();

            TempData["SuccessMessage"] = $"Transaksi {entry.ReferenceNumber} berhasil diklasifikasikan ke '{chosen.AccountName}'.";
            return RedirectToAction(nameof(Index));
        }

        // POST: /MobileClassification/Reject/5
        // Menghapus jurnal beserta baris-barisnya (membatalkan efek saldo).
        // Hanya berlaku untuk transaksi mobile yang belum diklasifikasikan.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Reject(int id)
        {
            var entry = await _context.JournalEntries
                .FirstOrDefaultAsync(e => e.Id == id && e.NeedsClassification && e.Source == "Mobile");

            if (entry == null)
            {
                TempData["ErrorMessage"] = "Transaksi tidak ditemukan atau sudah diklasifikasikan.";
                return RedirectToAction(nameof(Index));
            }

            _context.JournalEntries.Remove(entry);
            await _context.SaveChangesAsync();

            TempData["SuccessMessage"] = $"Transaksi {entry.ReferenceNumber} dihapus.";
            return RedirectToAction(nameof(Index));
        }

        private async Task<List<ChartOfAccount>> GetEligibleAccountsAsync(bool isIncome)
        {
            var types = isIncome
                ? new[] { "OperatingIncome", "OtherIncome" }
                : new[] { "OperatingExpenses", "OtherExpenses" };

            return await _context.ChartOfAccounts
                .Where(a => a.IsActive
                    && types.Contains(a.Type)
                    && a.Role != "UnclassifiedIncome"
                    && a.Role != "UnclassifiedExpense")
                .OrderBy(a => a.ReferenceNumber)
                .ToListAsync();
        }
    }
}
