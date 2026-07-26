using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers
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
            // Kolom wajib sesuai info yang ditampilkan di Views/Tools/Index.cshtml
            string[] headers = { "Date", "AccountCode", "Description", "Ref", "Debit", "Credit" };

            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("Journal Template");

            for (int i = 0; i < headers.Length; i++)
            {
                var cell = sheet.Cell(1, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#212529");
                cell.Style.Font.FontColor = XLColor.White;
            }

            // Baris contoh (row 2) supaya format kolom Date/Debit/Credit jelas
            sheet.Cell(2, 1).Value = DateTime.Today;
            sheet.Cell(2, 1).Style.DateFormat.Format = "yyyy-mm-dd";
            sheet.Cell(2, 2).Value = "101";
            sheet.Cell(2, 3).Value = "Contoh: Penerimaan kas awal";
            sheet.Cell(2, 4).Value = "JE-0001";
            sheet.Cell(2, 5).Value = 100000;
            sheet.Cell(2, 6).Value = 0;

            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            var content = stream.ToArray();

            return File(
                content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "JournalImportTemplate.xlsx");
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
