using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;
using System.Linq;
using System.Threading.Tasks;

namespace AumoFinance.Controllers
{
    public class ChartOfAccountsController : Controller
    {
        private readonly AppDbContext _context;

        public ChartOfAccountsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: Menampilkan tabel COA dan Modal — dibatasi ke akun milik
        // user yang sedang login (full per-user isolation).
        public async Task<IActionResult> Index()
        {
            var userId = this.CurrentUserId();

            // 1. Tarik master data COA milik user ini dan urutkan
            var accounts = await _context.ChartOfAccounts
                                         .Where(a => a.UserId == userId)
                                         .OrderBy(a => a.ReferenceNumber)
                                         .ToListAsync();

            var accountIds = accounts.Select(a => a.Id).ToList();

            // 2. Kalkulasi total Debit & Kredit dari JournalEntryLines untuk setiap akun
            var accountBalances = await _context.JournalEntryLines
                                                .Where(j => accountIds.Contains(j.AccountId))
                                                .GroupBy(j => j.AccountId)
                                                .Select(g => new
                                                {
                                                    AccountId = g.Key,
                                                    TotalDebit = g.Sum(j => j.Debit),
                                                    TotalCredit = g.Sum(j => j.Credit)
                                                })
                                                .ToDictionaryAsync(x => x.AccountId);

            // 3. Terapkan logika Normal Balance ke masing-masing akun
            foreach (var account in accounts)
            {
                if (accountBalances.TryGetValue(account.Id, out var balance))
                {
                    // Kelompok Akun bersaldo normal DEBIT
                    if (account.Type == "Assets" || account.Type == "OperatingExpenses" || account.Type == "OtherExpenses")
                    {
                        account.Balance = balance.TotalDebit - balance.TotalCredit;
                    }
                    // Kelompok Akun bersaldo normal KREDIT
                    else
                    {
                        account.Balance = balance.TotalCredit - balance.TotalDebit;
                    }
                }
                else
                {
                    // Jika belum ada transaksi jurnal, saldo 0
                    account.Balance = 0;
                }
            }

            return View(accounts);
        }

        // POST: Menangkap data dari Modal Add Account
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(ChartOfAccount model)
        {
            var userId = this.CurrentUserId();

            if (!ModelState.IsValid)
            {
                TempData["ErrorMessage"] = GetFirstModelError() ?? "Data akun tidak valid.";
                return RedirectToAction(nameof(Index));
            }

            // 1. Validasi Kedisiplinan: Pastikan nomor referensi tidak keluar dari rentang kategori
            if (!IsValidReferenceNumber(model.Type, model.ReferenceNumber))
            {
                TempData["ErrorMessage"] = $"Invalid reference number {model.ReferenceNumber} for category {model.Type}.";
                return RedirectToAction(nameof(Index));
            }

            // 2. Validasi Akurasi: Pastikan tidak ada duplikasi nomor akun DALAM akun milik user ini
            bool isCodeTaken = await _context.ChartOfAccounts.AnyAsync(a => a.UserId == userId && a.ReferenceNumber == model.ReferenceNumber);
            if (isCodeTaken)
            {
                TempData["ErrorMessage"] = $"Account code {model.ReferenceNumber} is already in use!";
                return RedirectToAction(nameof(Index));
            }

            // Set nilai bawaan untuk akun baru
            model.UserId = userId;
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

        // POST: Menangkap data dari Modal Edit Account
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(ChartOfAccount model)
        {
            var userId = this.CurrentUserId();
            var account = await _context.ChartOfAccounts.FirstOrDefaultAsync(a => a.Id == model.Id && a.UserId == userId);
            if (account == null)
            {
                TempData["ErrorMessage"] = "Account not found.";
                return RedirectToAction(nameof(Index));
            }

            if (!ModelState.IsValid)
            {
                TempData["ErrorMessage"] = GetFirstModelError() ?? "Data akun tidak valid.";
                return RedirectToAction(nameof(Index));
            }

            if (!IsValidReferenceNumber(model.Type, model.ReferenceNumber))
            {
                TempData["ErrorMessage"] = $"Invalid reference number {model.ReferenceNumber} for category {model.Type}.";
                return RedirectToAction(nameof(Index));
            }

            // Duplikasi nomor akun boleh sama dengan dirinya sendiri, tidak dengan akun lain milik user ini
            bool isCodeTaken = await _context.ChartOfAccounts
                .AnyAsync(a => a.UserId == userId && a.ReferenceNumber == model.ReferenceNumber && a.Id != model.Id);
            if (isCodeTaken)
            {
                TempData["ErrorMessage"] = $"Account code {model.ReferenceNumber} is already in use!";
                return RedirectToAction(nameof(Index));
            }

            account.ReferenceNumber = model.ReferenceNumber;
            account.AccountName = model.AccountName;
            account.Type = model.Type;
            account.Role = model.Role;
            account.IsActive = model.IsActive;

            try
            {
                await _context.SaveChangesAsync();
                TempData["SuccessMessage"] = $"Account '{account.AccountName}' successfully updated.";
            }
            catch (Exception)
            {
                TempData["ErrorMessage"] = "A fatal error occurred while updating the account.";
            }

            return RedirectToAction(nameof(Index));
        }

        // POST: Menghapus akun dari COA
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = this.CurrentUserId();
            var account = await _context.ChartOfAccounts.FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);
            if (account == null)
            {
                TempData["ErrorMessage"] = "Account not found.";
                return RedirectToAction(nameof(Index));
            }

            // Akun yang sudah dipakai di Journal Entry tidak boleh dihapus
            // (menjaga integritas General Ledger). Nonaktifkan saja.
            bool hasJournalLines = await _context.JournalEntryLines.AnyAsync(l => l.AccountId == id);
            if (hasJournalLines)
            {
                TempData["ErrorMessage"] = $"Account '{account.AccountName}' cannot be deleted because it already has journal entries. Set it to Inactive instead.";
                return RedirectToAction(nameof(Index));
            }

            try
            {
                _context.ChartOfAccounts.Remove(account);
                await _context.SaveChangesAsync();
                TempData["SuccessMessage"] = $"Account '{account.AccountName}' successfully deleted.";
            }
            catch (Exception)
            {
                TempData["ErrorMessage"] = "A fatal error occurred while deleting the account.";
            }

            return RedirectToAction(nameof(Index));
        }

        private string? GetFirstModelError()
        {
            return ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .FirstOrDefault();
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
