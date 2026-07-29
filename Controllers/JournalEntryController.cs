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
                .Where(l => l.AccountId != 0 && ((l.Debit ?? 0) != 0 || (l.Credit ?? 0) != 0))
                .ToList();

            if (model.Lines.Count < 2)
            {
                ModelState.AddModelError(string.Empty, "A journal entry must have at least two line items.");
            }

            var totalDebit = model.Lines.Sum(l => l.Debit ?? 0);
            var totalCredit = model.Lines.Sum(l => l.Credit ?? 0);

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
                ReferenceNumber = await GenerateReferenceNumberAsync(model.JournalType),
                JournalType = model.JournalType,
                EntryDate = DateTime.SpecifyKind(model.EntryDate, DateTimeKind.Utc),
                Lines = model.Lines.Select((l, index) => new JournalEntryLine
                {
                    AccountId = l.AccountId,
                    LineDescription = l.LineDescription,
                    Debit = l.Debit ?? 0,
                    Credit = l.Credit ?? 0,
                    LineOrder = index
                }).ToList()
            };

            _db.JournalEntries.Add(entry);
            await _db.SaveChangesAsync();

            TempData["SuccessMessage"] = $"Journal entry {entry.ReferenceNumber} has been posted.";
            return RedirectToAction(nameof(Create));
        }

        // Route: /JournalEntry/Edit/{id}
        [HttpGet]
        public async Task<IActionResult> Edit(int id)
        {
            var entry = await _db.JournalEntries
                .Include(j => j.Lines)
                .FirstOrDefaultAsync(j => j.Id == id);

            if (entry == null)
            {
                return NotFound();
            }

            ViewData["Title"] = $"Edit Journal Entry {entry.ReferenceNumber}";

            var model = new JournalEntryEditViewModel
            {
                Id = entry.Id,
                ReferenceNumber = entry.ReferenceNumber,
                JournalType = entry.JournalType,
                EntryDate = entry.EntryDate,
                Lines = entry.Lines
                    .OrderBy(l => l.LineOrder)
                    .Select(l => new JournalEntryLineInputModel
                    {
                        AccountId = l.AccountId,
                        LineDescription = l.LineDescription,
                        Debit = l.Debit == 0 ? null : l.Debit,
                        Credit = l.Credit == 0 ? null : l.Credit
                    }).ToList(),
                AvailableAccounts = await ActiveAccountsAsync()
            };

            return View(model);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(JournalEntryEditViewModel model)
        {
            var entry = await _db.JournalEntries
                .Include(j => j.Lines)
                .FirstOrDefaultAsync(j => j.Id == model.Id);

            if (entry == null)
            {
                return NotFound();
            }

            // Buang baris kosong (akun belum dipilih dan debit/kredit nol)
            model.Lines = model.Lines
                .Where(l => l.AccountId != 0 && ((l.Debit ?? 0) != 0 || (l.Credit ?? 0) != 0))
                .ToList();

            if (model.Lines.Count < 2)
            {
                ModelState.AddModelError(string.Empty, "A journal entry must have at least two line items.");
            }

            var totalDebit = model.Lines.Sum(l => l.Debit ?? 0);
            var totalCredit = model.Lines.Sum(l => l.Credit ?? 0);

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
                model.ReferenceNumber = entry.ReferenceNumber;
                model.AvailableAccounts = await ActiveAccountsAsync();
                return View(model);
            }

            // Referensi (GJ-xxxxxx / AJE-xxxxxx) dan tanggal dibuat (CreatedAt)
            // tidak diubah — hanya jenis jurnal, tanggal transaksi, dan baris
            // jurnal yang diperbarui. Baris lama dihapus lalu diganti baris baru
            // supaya urutan dan isi selalu sinkron dengan input pengguna.
            entry.JournalType = model.JournalType;
            entry.EntryDate = DateTime.SpecifyKind(model.EntryDate, DateTimeKind.Utc);

            _db.JournalEntryLines.RemoveRange(entry.Lines);
            entry.Lines = model.Lines.Select((l, index) => new JournalEntryLine
            {
                JournalEntryId = entry.Id,
                AccountId = l.AccountId,
                LineDescription = l.LineDescription,
                Debit = l.Debit ?? 0,
                Credit = l.Credit ?? 0,
                LineOrder = index
            }).ToList();

            await _db.SaveChangesAsync();

            TempData["SuccessMessage"] = $"Journal entry {entry.ReferenceNumber} has been updated.";
            return RedirectToAction("Index", "GeneralJournal");
        }

        // Membuat nomor referensi otomatis per jenis jurnal, mis. GJ-000001 / AJE-000001
        private async Task<string> GenerateReferenceNumberAsync(string journalType)
        {
            var prefix = journalType == "Adjusting" ? "AJE" : "GJ";

            var lastNumber = await _db.JournalEntries
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

        // GET: Cari deskripsi jurnal sebelumnya yang mirip, untuk fitur autocomplete
        [HttpGet]
        public async Task<IActionResult> SearchDescriptions(string q)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            {
                return Json(Array.Empty<string>());
            }

            var keyword = q.Trim();

            var results = await _db.JournalEntryLines
                .Where(l => l.LineDescription != null && l.LineDescription != "" && EF.Functions.ILike(l.LineDescription, $"%{keyword}%"))
                .GroupBy(l => l.LineDescription)
                .OrderByDescending(g => g.Count())
                .ThenByDescending(g => g.Max(l => l.Id))
                .Select(g => g.Key)
                .Take(8)
                .ToListAsync();

            return Json(results);
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
