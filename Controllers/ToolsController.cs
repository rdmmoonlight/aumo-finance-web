using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using AumoFinance.Models;
using AumoFinance.Models.DTOs;

namespace AumoFinance.Controllers
{
    public class ToolsController : Controller
    {
        private readonly AppDbContext _context;

        public ToolsController(AppDbContext context)
        {
            _context = context;
        }

        public IActionResult Index()
        {
            return View();
        }

        [HttpGet]
        public IActionResult ImportJournal()
        {
            return View();
        }

        // ==========================================
        // 1. PREVIEW DATA EXCEL (AJAX POST)
        // ==========================================
        [HttpPost]
        public async Task<IActionResult> PreviewJournal(IFormFile excelFile)
        {
            if (excelFile == null || excelFile.Length == 0)
            {
                return Json(new { success = false, message = "Please select a valid Excel file." });
            }

            var parseResult = await ParseJournalExcelAsync(excelFile);

            if (!parseResult.IsSuccess)
            {
                return Json(new { success = false, message = parseResult.Message });
            }

            // Simpan data parsed ke TempData
            TempData["ParsedImportData"] = JsonSerializer.Serialize(parseResult);

            return Json(new { success = true, data = parseResult });
        }

        // ==========================================
        // 2. IMPORT / SAVE DATA TO DATABASE
        // ==========================================
        [HttpPost]
        public async Task<IActionResult> ConfirmImport()
        {
            if (TempData["ParsedImportData"] is not string jsonStr)
            {
                TempData["ErrorMessage"] = "Import session expired. Please preview the file again.";
                return RedirectToAction(nameof(ImportJournal));
            }

            var parseResult = JsonSerializer.Deserialize<JournalImportResultDto>(jsonStr);
            if (parseResult == null || parseResult.Transactions.Count == 0)
            {
                TempData["ErrorMessage"] = "No valid transactions to import.";
                return RedirectToAction(nameof(ImportJournal));
            }

            int accountsCreated = 0;
            int transactionsImported = 0;

            try
            {
                foreach (var txDto in parseResult.Transactions)
                {
                    var entryLines = new List<JournalEntryLine>();

                    foreach (var lineDto in txDto.Lines)
                    {
                        var account = await _context.ChartOfAccounts
                            .FirstOrDefaultAsync(a => a.ReferenceNumber == lineDto.RefNumber);

                        if (account == null)
                        {
                            var accountType = AccountClassification.TypeFromReferenceNumber(lineDto.RefNumber);

                            account = new ChartOfAccount
                            {
                                ReferenceNumber = lineDto.RefNumber,
                                AccountName = lineDto.AccountName,
                                Type = accountType ?? "Other",
                                Role = "Default",
                                IsActive = true,
                            };

                            _context.ChartOfAccounts.Add(account);
                            accountsCreated++;
                        }

                        entryLines.Add(new JournalEntryLine
                        {
                            Account = account,
                            LineDescription = lineDto.Description,
                            Debit = lineDto.Debit ?? 0m,
                            Credit = lineDto.Credit ?? 0m,
                            LineOrder = entryLines.Count + 1
                        });
                    }

                    var entry = new JournalEntry
                    {
                        JournalType = txDto.JournalType,
                        EntryDate = txDto.Date,
                        Lines = entryLines,
                    };

                    _context.JournalEntries.Add(entry);
                    transactionsImported++;
                }

                await _context.SaveChangesAsync();

                TempData["SuccessMessage"] = $"Successfully imported {transactionsImported} journal entries with {accountsCreated} new COA accounts created.";
            }
            catch (Exception ex)
            {
                TempData["ErrorMessage"] = $"Failed to save entries: {ex.Message}";
            }

            return RedirectToAction(nameof(ImportJournal));
        }

        // Private Excel Parser
        private async Task<JournalImportResultDto> ParseJournalExcelAsync(IFormFile excelFile)
        {
            var result = new JournalImportResultDto();

            try
            {
                using var stream = new MemoryStream();
                await excelFile.CopyToAsync(stream);
                stream.Position = 0;

                using var workbook = new XLWorkbook(stream);

                var existingRefNumbers = await _context.ChartOfAccounts
                    .Select(a => a.ReferenceNumber)
                    .ToListAsync();

                var sheetMap = new (string SheetName, string JournalType)[]
                {
                    ("GJ", "General"),
                    ("AJ", "Adjusting")
                };

                foreach (var (sheetName, journalType) in sheetMap)
                {
                    if (!workbook.Worksheets.TryGetWorksheet(sheetName, out var sheet))
                        continue;

                    var lastRow = sheet.LastRowUsed()?.RowNumber() ?? 1;
                    JournalTransactionImportDto? currentTx = null;

                    for (int r = 2; r <= lastRow; r++)
                    {
                        var dateCell = sheet.Cell(r, 1);
                        var accountCell = sheet.Cell(r, 2);
                        var descCell = sheet.Cell(r, 3);
                        var refCell = sheet.Cell(r, 4);
                        var debitCell = sheet.Cell(r, 5);
                        var creditCell = sheet.Cell(r, 6);

                        if (dateCell.IsEmpty() && accountCell.IsEmpty() && refCell.IsEmpty())
                            continue;

                        if (!dateCell.IsEmpty())
                        {
                            if (dateCell.TryGetValue(out DateTime parsedDate))
                            {
                                currentTx = new JournalTransactionImportDto
                                {
                                    Date = parsedDate.Date,
                                    JournalType = journalType
                                };
                                result.Transactions.Add(currentTx);
                            }
                            else
                            {
                                result.Warnings.Add($"{sheetName} Row {r}: Invalid date format.");
                                continue;
                            }
                        }

                        if (currentTx == null) continue;

                        decimal? debitValue = null;
                        if (!debitCell.IsEmpty() && debitCell.TryGetValue(out decimal dVal)) debitValue = dVal;

                        decimal? creditValue = null;
                        if (!creditCell.IsEmpty() && creditCell.TryGetValue(out decimal cVal)) creditValue = cVal;

                        refCell.TryGetValue(out int refNum);

                        currentTx.Lines.Add(new JournalLineImportDto
                        {
                            RowIndex = r,
                            AccountName = accountCell.GetString().Trim(),
                            Description = descCell.GetString().Trim(),
                            RefNumber = refNum,
                            Debit = debitValue,
                            Credit = creditValue,
                            IsNewAccount = !existingRefNumbers.Contains(refNum)
                        });

                        result.TotalLinesRead++;
                    }
                }

                result.TotalTransactionsRead = result.Transactions.Count;
                result.IsSuccess = true;
            }
            catch (Exception ex)
            {
                result.IsSuccess = false;
                result.Message = $"Excel Parsing Error: {ex.Message}";
            }

            return result;
        }

        [HttpGet]
        public IActionResult DownloadJournalTemplate()
        {
            using var workbook = new XLWorkbook();

            BuildJournalSheetTemplate(
                workbook,
                sheetName: "GJ",
                rows: new[]
                {
                    (Account: "Cash on Hand", Desc: "Initial Owner Equity Contribution", Ref: 101, Debit: (decimal?)50000000m, Credit: (decimal?)null),
                    (Account: "Owner's Equity", Desc: "Initial Owner Equity Contribution", Ref: 301, Debit: (decimal?)null, Credit: (decimal?)50000000m),
                    (Account: "Prepaid Rent", Desc: "1-Year Office Rent Payment", Ref: 103, Debit: (decimal?)12000000m, Credit: (decimal?)null),
                    (Account: "Cash on Hand", Desc: "1-Year Office Rent Payment", Ref: 101, Debit: (decimal?)null, Credit: (decimal?)12000000m),
                });

            BuildJournalSheetTemplate(
                workbook,
                sheetName: "AJ",
                rows: new[]
                {
                    (Account: "Rent Expense", Desc: "Monthly Rent Adjustment - January", Ref: 502, Debit: (decimal?)1000000m, Credit: (decimal?)null),
                    (Account: "Prepaid Rent", Desc: "Monthly Rent Adjustment - January", Ref: 103, Debit: (decimal?)null, Credit: (decimal?)1000000m),
                });

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);

            return File(
                stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "JournalImportTemplate_EN.xlsx");
        }

        private static void BuildJournalSheetTemplate(
            XLWorkbook workbook,
            string sheetName,
            (string Account, string Desc, int Ref, decimal? Debit, decimal? Credit)[] rows)
        {
            string[] headers = { "Date", "Account Name", "Description", "Ref", "Debit", "Credit" };
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
            bool isFirstRowOfTransaction = true;

            foreach (var r in rows)
            {
                if (isFirstRowOfTransaction)
                {
                    sheet.Cell(row, 1).Value = exampleDate;
                    isFirstRowOfTransaction = false;
                }

                sheet.Cell(row, 2).Value = r.Account;
                sheet.Cell(row, 3).Value = r.Desc;
                sheet.Cell(row, 4).Value = r.Ref;

                if (r.Debit.HasValue) sheet.Cell(row, 5).Value = r.Debit.Value;
                if (r.Credit.HasValue) sheet.Cell(row, 6).Value = r.Credit.Value;

                row++;
            }

            sheet.Range(2, 1, row - 1, 1).Style.DateFormat.Format = "yyyy-mm-dd";
            sheet.Columns().AdjustToContents();
        }
    }
}
