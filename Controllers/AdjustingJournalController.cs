using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public class AdjustingJournalController : Controller
    {
        private readonly AppDbContext _db;

        public AdjustingJournalController(AppDbContext db)
        {
            _db = db;
        }

        // Route access: /AdjustingJournal atau /AdjustingJournal/Index.
        // Menampilkan entri jurnal dengan JournalType == "Adjusting" saja —
        // sumber data yang sama dengan General Journal, hanya difilter.
        public async Task<IActionResult> Index()
        {
            ViewData["Title"] = "Adjusting Journal";

            var allEntries = await _db.JournalEntries
                .Include(j => j.Lines)
                    .ThenInclude(l => l.Account)
                .Where(j => j.JournalType == "Adjusting")
                .OrderByDescending(j => j.EntryDate)
                .ThenByDescending(j => j.Id)
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
