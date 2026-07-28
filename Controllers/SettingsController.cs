using Microsoft.AspNetCore.Mvc;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public class SettingsController : Controller
    {
        // GET: Menampilkan halaman pengaturan
        [HttpGet]
        public IActionResult Index()
        {
            // TODO: Ambil data dari database berdasarkan User ID saat ini
            // Simulasi data yang diambil dari database:
            var userSettings = new SettingsViewModel
            {
                IsDarkMode = true,
                EnableSystemAlerts = true
            };

            return View(userSettings);
        }

        // POST: Menerima data dari form untuk disimpan
        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult SaveSettings(SettingsViewModel model)
        {
            if (!ModelState.IsValid)
            {
                // Jika data tidak valid, kembalikan ke halaman pengaturan dengan error
                return View("Index", model);
            }

            // TODO: Simpan model ke database berdasarkan User ID
            // var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            // _dbContext.UserSettings.Update(...);
            // _dbContext.SaveChanges();

            // Kirim pesan sukses ke View
            TempData["SuccessMessage"] = "Pengaturan berhasil disimpan ke sistem.";
            
            return RedirectToAction("Index");
        }
    }
}
