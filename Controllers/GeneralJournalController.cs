using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public class GeneralJournalController : Controller
    {
        private readonly AppDbContext _db;

        public GeneralJournalController(AppDbContext db)
        {
            _db = db;
        }

        // Route access: /GeneralJournal or /GeneralJournal/Index
        public async Task<IActionResult> Index()
        {
            ViewData["Title"] = "General Journal";

            // Diambil langsung dari data yang diinput lewat Journal Entry,
            // termasuk relasi ke Chart of Account, sehingga nomor referensi
            // dan nama akun selalu sinkron dengan sumbernya.
            var allEntries = await _db.JournalEntries
                .Include(j => j.Lines)
                    .ThenInclude(l => l.Account)
                .OrderBy(j => j.EntryDate)
                .ThenBy(j => j.Id)
                .ToListAsync();

            // Entri bertanggal di dalam periode yang sudah ditutup disembunyikan
            // dari sini — hanya bisa dibaca kembali lewat Periods > View.
            var closedPeriods = await _db.Periods.Where(p => p.IsClosed).ToListAsync();
            var entries = allEntries
                .Where(e => !PeriodLock.IsDateLocked(e.EntryDate, closedPeriods))
                .ToList();

            ViewBag.HiddenClosedCount = allEntries.Count - entries.Count;

            return View(entries);
        }
    }
}
