using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public class ChartOfAccountsController : Controller
    {
        private readonly AppDbContext _context;

        public ChartOfAccountsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: Menampilkan tabel COA dan Modal
        public async Task<IActionResult> Index()
        {
            // Menampilkan akun diurutkan berdasarkan Nomor Referensi agar rapi
            var accounts = await _context.ChartOfAccounts
                                         .OrderBy(a => a.ReferenceNumber)
                                         .ToListAsync();
            return View(accounts);
        }

        // POST: Menangkap data dari Modal Add Account
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(ChartOfAccount model)
        {
            // 1. Validasi Kedisiplinan: Pastikan nomor referensi tidak keluar dari rentang kategori
            if (!IsValidReferenceNumber(model.Type, model.ReferenceNumber))
            {
                TempData["ErrorMessage"] = $"Invalid reference number {model.ReferenceNumber} for category {model.Type}.";
                return RedirectToAction(nameof(Index));
            }

            // 2. Validasi Akurasi: Pastikan tidak ada duplikasi nomor akun
            bool isCodeTaken = await _context.ChartOfAccounts.AnyAsync(a => a.ReferenceNumber == model.ReferenceNumber);
            if (isCodeTaken)
            {
                TempData["ErrorMessage"] = $"Account code {model.ReferenceNumber} is already in use!";
                return RedirectToAction(nameof(Index));
            }

            // Set nilai bawaan untuk akun baru
            model.IsActive = true;
            model.Balance = 0;

            try
            {
                _context.ChartOfAccounts.Add(model);
                await _context.SaveChangesAsync();
                
                TempData["SuccessMessage"] = $"Account '{model.AccountName}' successfully created.";
            }
            catch (Exception)
            {
                TempData["ErrorMessage"] = "A fatal error occurred while saving the account.";
            }

            return RedirectToAction(nameof(Index));
        }

        // Fungsi internal untuk validasi mutlak rentang penomoran
        private bool IsValidReferenceNumber(string type, int refNumber)
        {
            return type switch
            {
                "Assets" => refNumber >= 100 && refNumber <= 199,
                "Liabilities" => refNumber >= 200 && refNumber <= 299,
                "Equity" => refNumber >= 300 && refNumber <= 399,
                "OperatingIncome" => refNumber >= 400 && refNumber <= 499,
                "OperatingExpenses" => refNumber >= 500 && refNumber <= 599,
                "OtherIncome" => refNumber >= 600 && refNumber <= 799,
                "OtherExpenses" => refNumber >= 800 && refNumber <= 999,
                _ => false
            };
        }
    }
}
