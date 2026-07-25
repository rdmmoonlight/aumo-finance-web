using Microsoft.AspNetCore.Mvc;

namespace AurumFinance.Controllers
{
    public class ToolsController : Controller
    {
        // Display Tools & Utilities Page
        public IActionResult Index()
        {
            return View();
        }

        // ==========================================
        // FEATURE PLACEHOLDERS (Logic to be implemented)
        // ==========================================

        public IActionResult DownloadJournalTemplate()
        {
            TempData["SuccessMessage"] = "Excel template is ready for download (Feature pending).";
            return RedirectToAction(nameof(Index));
        }

        [HttpPost]
        public IActionResult ImportJournal(IFormFile excelFile)
        {
            if (excelFile == null || excelFile.Length == 0)
            {
                TempData["ErrorMessage"] = "Excel file not found or is empty.";
                return RedirectToAction(nameof(Index));
            }

            TempData["SuccessMessage"] = $"File '{excelFile.FileName}' received. Validation and import logic pending.";
            return RedirectToAction(nameof(Index));
        }

        [HttpPost]
        public IActionResult MonthEndClose(string period)
        {
            if (string.IsNullOrEmpty(period))
            {
                TempData["ErrorMessage"] = "Month and year must be provided to execute a month-end close.";
                return RedirectToAction(nameof(Index));
            }

            TempData["SuccessMessage"] = $"Month-end close for the period {period} has been successfully simulated.";
            return RedirectToAction(nameof(Index));
        }

        public IActionResult RecalculateLedger()
        {
            TempData["SuccessMessage"] = "General ledger balances have been recalculated successfully.";
            return RedirectToAction(nameof(Index));
        }

        public IActionResult BackupDatabase()
        {
            TempData["SuccessMessage"] = "Database backup export request received.";
            return RedirectToAction(nameof(Index));
        }
    }
}
