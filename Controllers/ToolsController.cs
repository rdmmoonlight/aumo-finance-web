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
            // Header wajib. Satu Date = satu transaksi: baris-baris dengan
            // Date yang sama adalah satu transaksi yang sama (bisa 1 baris
            // Debit dengan beberapa baris Credit, atau sebaliknya).
            string[] headers = { "Date", "Account Name", "Ref", "Debit", "Credit" };

            using var workbook = new XLWorkbook();

            BuildJournalSheet(
                workbook,
                sheetName: "GJ",
                exampleRef: "GJ-0001",
                exampleMemo1: "Cash on Hand",
                exampleMemo2: "Sales Revenue",
                exampleMemo3: "Service Revenue",
                headers: headers);

            BuildJournalSheet(
                workbook,
                sheetName: "AJ",
                exampleRef: "AJ-0001",
                exampleMemo1: "Depreciation Expense",
                exampleMemo2: "Accumulated Depreciation",
                exampleMemo3: null,
                headers: headers);

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            var content = stream.ToArray();

            return File(
                content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "JournalImportTemplate.xlsx");
        }

        // Membangun 1 sheet jurnal (GJ atau AJ) dengan header dan 1 contoh
        // transaksi. Contoh transaksi memakai Date yang sama pada setiap
        // baris untuk menunjukkan bahwa Date yang sama = satu transaksi,
        // walau Debit hanya 1 baris dan Credit lebih dari 1 baris.
        private static void BuildJournalSheet(
            XLWorkbook workbook,
            string sheetName,
            string exampleRef,
            string exampleMemo1,
            string exampleMemo2,
            string? exampleMemo3,
            string[] headers)
        {
            var sheet = workbook.Worksheets.Add(sheetName);

            for (int i = 0; i < headers.Length; i++)
            {
                var cell = sheet.Cell(1, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#212529");
                cell.Style.Font.FontColor = XLColor.White;
            }

            var exampleDate = DateTime.Today;
            int row = 2;

            // Baris 1: Debit tunggal
            sheet.Cell(row, 1).Value = exampleDate;
            sheet.Cell(row, 2).Value = exampleMemo1;
            sheet.Cell(row, 3).Value = exampleRef;
            sheet.Cell(row, 4).Value = 500000;
            sheet.Cell(row, 5).Value = 0;
            row++;

            // Baris 2: Credit pertama, Date sama = masih transaksi yang sama
            sheet.Cell(row, 1).Value = exampleDate;
            sheet.Cell(row, 2).Value = exampleMemo2;
            sheet.Cell(row, 3).Value = exampleRef;
            sheet.Cell(row, 4).Value = 0;
            sheet.Cell(row, 5).Value = exampleMemo3 != null ? 300000 : 500000;
            row++;

            // Baris 3: Credit kedua (khusus GJ, untuk contoh 1 Debit banyak Credit)
            if (exampleMemo3 != null)
            {
                sheet.Cell(row, 1).Value = exampleDate;
                sheet.Cell(row, 2).Value = exampleMemo3;
                sheet.Cell(row, 3).Value = exampleRef;
                sheet.Cell(row, 4).Value = 0;
                sheet.Cell(row, 5).Value = 200000;
                row++;
            }

            sheet.Range(2, 1, row - 1, 1).Style.DateFormat.Format = "yyyy-mm-dd";
            sheet.Columns().AdjustToContents();
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
