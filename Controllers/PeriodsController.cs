using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AurumFinance.Models; // Sesuaikan jika folder modelmu berbeda

namespace AurumFinance.Controllers
{
    public class PeriodsController : Controller
    {
        private readonly AppDbContext _context;

        public PeriodsController(AppDbContext context)
        {
            _context = context;
        }

        // Halaman utama Daftar Periode
        public async Task<IActionResult> Index()
        {
            // Ambil semua data periode, urutkan dari yang terbaru
            var periods = await _context.Periods
                                        .OrderByDescending(p => p.StartDate)
                                        .ToListAsync();
            
            return View(periods);
        }

        // Halaman form Create (tampilannya bisa disusul nanti)
        public IActionResult Create()
        {
            return View();
        }
    }
}
