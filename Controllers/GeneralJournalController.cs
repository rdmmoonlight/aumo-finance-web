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

            var userId = this.CurrentUserId();
            var selectedPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
            ViewBag.SelectedPeriod = selectedPeriod;

            if (selectedPeriod == null)
            {
                return View(new List<JournalEntry>());
            }

            // Diambil langsung dari data yang diinput lewat Journal Entry,
            // termasuk relasi ke Chart of Account, sehingga nomor referensi
            // dan nama akun selalu sinkron dengan sumbernya. Dibatasi ke
            // milik user ini sendiri, dan hanya entri bertanggal di dalam
            // periode yang sedang di-view.
            var entries = await _db.JournalEntries
                .Include(j => j.Lines)
                    .ThenInclude(l => l.Account)
                .Where(j => j.UserId == userId
                         && j.EntryDate >= selectedPeriod.StartDate && j.EntryDate <= selectedPeriod.EndDate)
                .OrderBy(j => j.EntryDate)
                .ThenBy(j => j.Id)
                .ToListAsync();

            return View(entries);
        }
    }
}
