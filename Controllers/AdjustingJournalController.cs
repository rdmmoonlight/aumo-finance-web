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

            var entries = await _db.JournalEntries
                .Include(j => j.Lines)
                    .ThenInclude(l => l.Account)
                .Where(j => j.JournalType == "Adjusting")
                .OrderByDescending(j => j.EntryDate)
                .ThenByDescending(j => j.Id)
                .ToListAsync();

            return View(entries);
        }
    }
}
