using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models; 

namespace AurumFinance.Controllers
{
    public class PeriodsController : Controller
    {
        private readonly AppDbContext _context;

        public PeriodsController(AppDbContext context)
        {
            _context = context;
        }

        // Main Periods List Page
        public async Task<IActionResult> Index()
        {
            // Fetch all periods, ordered by newest start date
            var periods = await _context.Periods
                                        .OrderByDescending(p => p.StartDate)
                                        .ToListAsync();
            
            return View(periods);
        }

        // Create Form Page (UI to be implemented)
        public IActionResult Create()
        {
            return View();
        }
    }
}
