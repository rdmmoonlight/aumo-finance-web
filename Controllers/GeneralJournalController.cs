using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AurumFinance.Models;

namespace AurumFinance.Controllers
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
            var entries = await _db.JournalEntries
                .Include(j => j.Lines)
                    .ThenInclude(l => l.Account)
                .OrderByDescending(j => j.EntryDate)
                .ThenByDescending(j => j.Id)
                .ToListAsync();

            return View(entries);
        }
    }
}
