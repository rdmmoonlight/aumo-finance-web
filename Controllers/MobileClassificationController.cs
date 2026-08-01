using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    // Konektor tunggal antara data mobile (MobileJournalEntries/Lines) dan
    // data utama (JournalEntries/JournalEntryLines). Tabel mobile dan tabel
    // web TIDAK PERNAH bercampur langsung — satu-satunya jalan masuk data
    // mobile ke pembukuan utama adalah lewat Verify() di halaman ini.
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
            var entries = await _context.MobileJournalEntries
                .Where(m => m.Status == "Pending")
                .OrderByDescending(m => m.SubmittedAt)
                .ToListAsync();

            var lineCounts = await _context.MobileJournalEntryLines
                .Where(l => entries.Select(e => e.Id).Contains(l.MobileJournalEntryId))
                .GroupBy(l => l.MobileJournalEntryId)
                .Select(g => new { MobileJournalEntryId = g.Key, Count = g.Count(), Total = g.Sum(x => x.Debit) })
                .ToListAsync();

            var list = entries.Select(e =>
            {
                var lc = lineCounts.FirstOrDefault(x => x.MobileJournalEntryId == e.Id);
                return new MobilePendingListItemViewModel
                {
                    Id = e.Id,
                    EntryDate = e.EntryDate,
                    Mode = e.Mode,
                    Type = e.Type,
                    Amount = e.Mode == "Manual" ? (lc?.Total ?? 0) : (e.Amount ?? 0),
                    Note = e.Note,
                    Status = e.Status,
                    SubmittedAt = e.SubmittedAt,
                    LineCount = lc?.Count ?? 0
                };
            }).ToList();

            return View(list);
        }

        // GET: /MobileClassification/Classify/5  (mode Simple)
        public async Task<IActionResult> Classify(int id)
        {
            var entry = await _context.MobileJournalEntries
                .FirstOrDefaultAsync(m => m.Id == id && m.Status == "Pending" && m.Mode == "Simple");

            if (entry == null)
            {
                TempData["ErrorMessage"] = "Transaksi tidak ditemukan atau sudah diproses.";
                return RedirectToAction(nameof(Index));
            }

            var isIncome = entry.Type == "Income";

            var vm = new MobileClassifySimpleViewModel
            {
                MobileJournalEntryId = entry.Id,
                EntryDate = entry.EntryDate,
                Type = entry.Type ?? string.Empty,
                Amount = entry.Amount ?? 0,
                Note = entry.Note,
                CashAccounts = await GetCashAccountsAsync(),
                IncomeOrExpenseAccounts = await GetEligibleAccountsAsync(isIncome)
            };

            return View(vm);
        }

        // POST: /MobileClassification/Classify/5  (mode Simple)
        // Verifikasi: baru di sini JournalEntry + 2 JournalEntryLine dibuat
        // di tabel utama. Baris MobileJournalEntry ditandai Verified, tidak dihapus.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Classify(int id, MobileClassifySimpleViewModel model)
        {
            var entry = await _context.MobileJournalEntries
                .FirstOrDefaultAsync(m => m.Id == id && m.Status == "Pending" && m.Mode == "Simple");

            if (entry == null)
            {
                TempData["ErrorMessage"] = "Transaksi tidak ditemukan atau sudah diproses.";
                return RedirectToAction(nameof(Index));
            }

            var isIncome = entry.Type == "Income";

            var cashAccount = (await GetCashAccountsAsync()).FirstOrDefault(a => a.Id == model.CashAccountId);
            var classifiedAccount = (await GetEligibleAccountsAsync(isIncome)).FirstOrDefault(a => a.Id == model.ClassifiedAccountId);

            if (cashAccount == null || classifiedAccount == null)
            {
                TempData["ErrorMessage"] = "Akun kas atau akun klasifikasi tidak valid.";
                return RedirectToAction(nameof(Classify), new { id });
            }

            var amount = entry.Amount ?? 0;
            var referenceNumber = await GenerateReferenceNumberAsync("General");

            var journalEntry = new JournalEntry
            {
                ReferenceNumber = referenceNumber,
                EntryDate = entry.EntryDate,
                JournalType = "General",
                CreatedAt = DateTime.UtcNow,
                Source = "Mobile",
                NeedsClassification = false,
                MobileNote = entry.Note,
                Lines = isIncome
                    ? new List<JournalEntryLine>
                    {
                        new() { AccountId = cashAccount.Id, Debit = amount, Credit = 0, LineOrder = 0, LineDescription = entry.Note },
                        new() { AccountId = classifiedAccount.Id, Debit = 0, Credit = amount, LineOrder = 1, LineDescription = entry.Note }
                    }
                    : new List<JournalEntryLine>
                    {
                        new() { AccountId = classifiedAccount.Id, Debit = amount, Credit = 0, LineOrder = 0, LineDescription = entry.Note },
                        new() { AccountId = cashAccount.Id, Debit = 0, Credit = amount, LineOrder = 1, LineDescription = entry.Note }
                    }
            };

            _context.JournalEntries.Add(journalEntry);

            entry.Status = "Verified";
            entry.VerifiedAt = DateTime.UtcNow;
            entry.VerifiedJournalEntry = journalEntry;

            await _context.SaveChangesAsync();

            TempData["SuccessMessage"] = $"Transaksi mobile berhasil diverifikasi menjadi {referenceNumber}.";
            return RedirectToAction(nameof(Index));
        }

        // GET: /MobileClassification/ClassifyManual/5  (mode Manual)
        public async Task<IActionResult> ClassifyManual(int id)
        {
            var entry = await _context.MobileJournalEntries
                .Include(m => m.Lines)
                    .ThenInclude(l => l.Account)
                .FirstOrDefaultAsync(m => m.Id == id && m.Status == "Pending" && m.Mode == "Manual");

            if (entry == null)
            {
                TempData["ErrorMessage"] = "Jurnal tidak ditemukan atau sudah diproses.";
                return RedirectToAction(nameof(Index));
            }

            var vm = new MobileClassifyManualViewModel
            {
                MobileJournalEntryId = entry.Id,
                EntryDate = entry.EntryDate,
                Note = entry.Note,
                Lines = entry.Lines
                    .OrderBy(l => l.LineOrder)
                    .Select(l => new MobileClassifyManualLineViewModel
                    {
                        AccountId = l.AccountId,
                        AccountName = l.Account?.AccountName ?? "-",
                        LineDescription = l.LineDescription,
                        Debit = l.Debit,
                        Credit = l.Credit
                    }).ToList()
            };

            return View(vm);
        }

        // POST: /MobileClassification/ApproveManual/5
        // Akun tiap baris sudah dipilih dari app; verifikasi di sini hanya
        // memindahkan baris apa adanya ke JournalEntries/JournalEntryLines.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ApproveManual(int id)
        {
            var entry = await _context.MobileJournalEntries
                .Include(m => m.Lines)
                .FirstOrDefaultAsync(m => m.Id == id && m.Status == "Pending" && m.Mode == "Manual");

            if (entry == null)
            {
                TempData["ErrorMessage"] = "Jurnal tidak ditemukan atau sudah diproses.";
                return RedirectToAction(nameof(Index));
            }

            var totalDebit = entry.Lines.Sum(l => l.Debit);
            var totalCredit = entry.Lines.Sum(l => l.Credit);
            if (totalDebit != totalCredit || totalDebit == 0)
            {
                TempData["ErrorMessage"] = "Jurnal tidak seimbang, tidak bisa diverifikasi.";
                return RedirectToAction(nameof(ClassifyManual), new { id });
            }

            var referenceNumber = await GenerateReferenceNumberAsync("General");

            var journalEntry = new JournalEntry
            {
                ReferenceNumber = referenceNumber,
                EntryDate = entry.EntryDate,
                JournalType = "General",
                CreatedAt = DateTime.UtcNow,
                Source = "Mobile",
                NeedsClassification = false,
                MobileNote = entry.Note,
                Lines = entry.Lines
                    .OrderBy(l => l.LineOrder)
                    .Select(l => new JournalEntryLine
                    {
                        AccountId = l.AccountId,
                        Debit = l.Debit,
                        Credit = l.Credit,
                        LineOrder = l.LineOrder,
                        LineDescription = l.LineDescription
                    }).ToList()
            };

            _context.JournalEntries.Add(journalEntry);

            entry.Status = "Verified";
            entry.VerifiedAt = DateTime.UtcNow;
            entry.VerifiedJournalEntry = journalEntry;

            await _context.SaveChangesAsync();

            TempData["SuccessMessage"] = $"Jurnal mobile berhasil diverifikasi menjadi {referenceNumber}.";
            return RedirectToAction(nameof(Index));
        }

        // POST: /MobileClassification/Reject/5
        // Baris mobile TIDAK dihapus — hanya ditandai Rejected, supaya
        // riwayat input tetap ada. Tidak pernah menyentuh JournalEntries.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Reject(int id)
        {
            var entry = await _context.MobileJournalEntries
                .FirstOrDefaultAsync(m => m.Id == id && m.Status == "Pending");

            if (entry == null)
            {
                TempData["ErrorMessage"] = "Transaksi tidak ditemukan atau sudah diproses.";
                return RedirectToAction(nameof(Index));
            }

            entry.Status = "Rejected";
            entry.RejectedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            TempData["SuccessMessage"] = "Transaksi mobile ditolak.";
            return RedirectToAction(nameof(Index));
        }

        private Task<List<ChartOfAccount>> GetCashAccountsAsync()
        {
            return _context.ChartOfAccounts
                .Where(a => a.IsActive && a.Role == "CashAndEquivalents")
                .OrderBy(a => a.ReferenceNumber)
                .ToListAsync();
        }

        private Task<List<ChartOfAccount>> GetEligibleAccountsAsync(bool isIncome)
        {
            var types = isIncome
                ? new[] { "OperatingIncome", "OtherIncome" }
                : new[] { "OperatingExpenses", "OtherExpenses" };

            return _context.ChartOfAccounts
                .Where(a => a.IsActive && types.Contains(a.Type))
                .OrderBy(a => a.ReferenceNumber)
                .ToListAsync();
        }

        // Sama persis dengan JournalEntryController.GenerateReferenceNumberAsync,
        // supaya penomoran referensi konsisten antara input via web dan via
        // mobile yang sudah diverifikasi.
        private async Task<string> GenerateReferenceNumberAsync(string journalType)
        {
            var prefix = journalType == "Adjusting" ? "AJE" : "GJ";

            var lastNumber = await _context.JournalEntries
                .Where(e => e.ReferenceNumber.StartsWith(prefix + "-"))
                .OrderByDescending(e => e.Id)
                .Select(e => e.ReferenceNumber)
                .FirstOrDefaultAsync();

            var nextSeq = 1;
            if (lastNumber != null)
            {
                var parts = lastNumber.Split('-');
                if (parts.Length == 2 && int.TryParse(parts[1], out var lastSeq))
                {
                    nextSeq = lastSeq + 1;
                }
            }

            return $"{prefix}-{nextSeq:D6}";
        }
    }
}
