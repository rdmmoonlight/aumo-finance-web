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
        // 1. STAGE 1: PREVIEW EXCEL DATA
        // ==========================================
        [HttpPost]
        public async Task<IActionResult> PreviewJournal(IFormFile excelFile)
        {
            if (excelFile == null || excelFile.Length == 0)
            {
                TempData["ErrorMessage"] = "Please select a valid non-empty Excel file.";
                return RedirectToAction(nameof(ImportJournal));
            }

            var parseResult = await ParseJournalExcelAsync(excelFile);

            if (!parseResult.IsSuccess)
            {
                TempData["ErrorMessage"] = parseResult.Message;
                return RedirectToAction(nameof(ImportJournal));
            }

            // Save JSON preview state into TempData
            TempData["ParsedImportData"] = JsonSerializer.Serialize(parseResult);
            TempData["SuccessMessage"] = $"Preview generated successfully. Please review the {parseResult.TotalTransactionsRead} transactions below.";

            return View("ImportJournal", parseResult);
        }

        // ==========================================
        // 2. STAGE 2: CONFIRM & SAVE TO DATABASE
        // ==========================================
        [HttpPost]
        public async Task<IActionResult> ConfirmImport()
        {
            if (TempData["ParsedImportData"] is not string jsonStr)
            {
                TempData["ErrorMessage"] = "Import session expired or data missing. Please re-upload the file.";
                return RedirectToAction(nameof(ImportJournal));
            }

            var parseResult = JsonSerializer.Deserialize<JournalImportResultDto>(jsonStr);
            if (parseResult == null || parseResult.Transactions.Count == 0)
            {
                TempData["ErrorMessage"] = "No transactions found to import.";
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

                TempData["SuccessMessage"] = $"Import completed! Saved {transactionsImported} transactions and created {accountsCreated} new COA accounts.";
            }
            catch (Exception ex)
            {
                TempData["ErrorMessage"] = $"Failed to save entries to the database: {ex.Message}";
            }

            return RedirectToAction(nameof(ImportJournal));
        }

        // Private Excel Parser Method
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

                        // Transaction Date Grouping
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

                        if (currentTx == null)
                        {
                            result.Warnings.Add($"{sheetName} Row {r}: Row skipped because it is not grouped under an initial transaction date.");
                            continue;
                        }

                        // Handle Nullable Debit / Credit
                        decimal? debitValue = null;
                        if (!debitCell.IsEmpty() && debitCell.TryGetValue(out decimal dVal))
                        {
                            debitValue = dVal;
                        }

                        decimal? creditValue = null;
                        if (!creditCell.IsEmpty() && creditCell.TryGetValue(out decimal cVal))
                        {
                            creditValue = cVal;
                        }

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

        // Download Template
        [HttpGet]
        public IActionResult DownloadJournalTemplate()
        {
            var filePath = Path.Combine(Directory.GetCurrentDirectory(), "JournalImportTemplate_EN.xlsx");
            
            if (!System.IO.File.Exists(filePath))
            {
                TempData["ErrorMessage"] = "Template file not found on the server.";
                return RedirectToAction(nameof(ImportJournal));
            }

            var fileBytes = System.IO.File.ReadAllBytes(filePath);
            return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "JournalImportTemplate_EN.xlsx");
        }
    }
}
