using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            // Tampilkan halaman Home (Index.cshtml) beserta semua muatannya,
            // tanpa peduli apakah user sudah login atau belum.
            return View();
        }

        public IActionResult Privacy()
        {
            return View();
        }
        
        // ... action lain seperti Welcome, dll.
    }
}