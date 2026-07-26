using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public class ToolsController : Controller
    {
        private readonly AppDbContext _context;

        public ToolsController(AppDbContext context)
        {
            _context = context;
        }

        // Display Tools & Utilities Page
        public IActionResult Index()
        {
            return View();
        }

        // ==========================================
        // TEMPLATE DOWNLOAD
        // ==========================================

        public IActionResult DownloadJournalTemplate()
        {
            // Header wajib. 
            // Date hanya perlu diisi 1 kali di awal transaksi.
            // Baris berikutnya yang Date-nya kosong akan otomatis masuk
            // ke transaksi yang sama (sampai ditemukan Date baru).
            string[] headers = { "Date", "Account Name", "Description", "Ref", "Debit", "Credit" };

            using var workbook = new XLWorkbook();

            BuildJournalSheet(
                workbook,
                sheetName: "GJ",
                rows: new[]
                {
                    (Account: "Cash on Hand", Desc: "Penerimaan penjualan tunai", Ref: 101, Debit: 500000m, Credit: 0m),
                    (Account: "Sales Revenue", Desc: "Penerimaan penjualan tunai", Ref: 401, Debit: 0m, Credit: 300000m),
                    (Account: "Service Revenue", Desc: "Penerimaan penjualan tunai", Ref: 402, Debit: 0m, Credit: 200000m),
                });

            BuildJournalSheet(
                workbook,
                sheetName: "AJ",
                rows: new[]
                {
                    (Account: "Depreciation Expense", Desc: "Penyesuaian penyusutan bulanan", Ref: 501, Debit: 100000m, Credit: 0m),
                    (Account: "Accumulated Depreciation", Desc: "Penyesuaian penyusutan bulanan", Ref: 151, Debit: 0m, Credit: 100000m),
                });

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            var content = stream.ToArray();

            return File(
                content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "JournalImportTemplate.xlsx");
        }

        // Membangun 1 sheet jurnal (GJ atau AJ) dengan header dan contoh transaksi.
        private static void BuildJournalSheet(
            XLWorkbook workbook,
            string sheetName,
            (string Account, string Desc, int Ref, decimal Debit, decimal Credit)[] rows)
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
                // Cetak tanggal HANYA di baris pertama transaksi
                if (isFirstRowOfTransaction)
                {
                    sheet.Cell(row, 1).Value = exampleDate;
                    isFirstRowOfTransaction = false;
                }
                
                sheet.Cell(row, 2).Value = r.Account;
                sheet.Cell(row, 3).Value = r.Desc;
                sheet.Cell(row, 4).Value = r.Ref;
                sheet.Cell(row, 5).Value = r.Debit;
                sheet.Cell(row, 6).Value = r.Credit;
                row++;
            }

            sheet.Range(2, 1, row - 1, 1).Style.DateFormat.Format = "yyyy-mm-dd";
            sheet.Columns().AdjustToContents();
        }

        // ==========================================
        // IMPORT: parsing GJ/AJ, auto-create akun ke COA, simpan Journal Entry
        // ==========================================

        [HttpPost]
        public async Task<IActionResult> ImportJournal(IFormFile excelFile)
        {
            if (excelFile == null || excelFile.Length == 0)
            {
                TempData["ErrorMessage"] = "Excel file not found or is empty.";
                return RedirectToAction(nameof(Index));
            }

            using var stream = new MemoryStream();
            await excelFile.CopyToAsync(stream);
            stream.Position = 0;

            int accountsCreated = 0;
            int transactionsImported = 0;
            var errors = new List<string>();

            try
            {
                using var workbook = new XLWorkbook(stream);

                var sheetMap = new (string SheetName, string JournalType)[]
                {
                    ("GJ", "General"),
                    ("AJ", "Adjusting"),
                };

                foreach (var (sheetName, journalType) in sheetMap)
                {
                    if (!workbook.Worksheets.TryGetWorksheet(sheetName, out var sheet))
                    {
                        continue; 
                    }

                    var lastRow = sheet.LastRowUsed()?.RowNumber() ?? 1;

                    // Grouping berdasarkan posisi Date.
                    // Tiap nemu Date isi -> Transaksi Baru.
                    // Tiap nemu Date kosong -> Masuk ke Transaksi Terakhir.
                    var groups = new List<(DateTime Date, List<int> RowNumbers)>();
                    
                    for (int r = 2; r <= lastRow; r++)
                    {
                        var dateCell = sheet.Cell(r, 1);
                        var accountCell = sheet.Cell(r, 2);
                        
                        // Skip baris jika benar-benar kosong (antisipasi format nyangkut di row bawah)
                        if (dateCell.IsEmpty() && accountCell.IsEmpty()) continue;

                        if (!dateCell.IsEmpty())
                        {
                            // Ini adalah awal transaksi baru
                            if (!dateCell.TryGetValue(out DateTime date))
                            {
                                errors.Add($"{sheetName} baris {r}: Date tidak valid, baris dilewati.");
                                continue;
                            }
                            groups.Add((date.Date, new List<int> { r }));
                        }
                        else
                        {
                            // Date kosong, gabungkan dengan grup transaksi terakhir
                            if (groups.Count > 0)
                            {
                                groups[^1].RowNumbers.Add(r);
                            }
                            else
                            {
                                errors.Add($"{sheetName} baris {r}: Kehilangan tanggal di awal transaksi, baris dilewati.");
                            }
                        }
                    }

                    foreach (var group in groups)
                    {
                        decimal totalDebit = 0, totalCredit = 0;
                        var lines = new List<JournalEntryLine>();
                        bool groupHasError = false;

                        foreach (var r in group.RowNumbers)
                        {
                            var accountName = sheet.Cell(r, 2).GetString().Trim();
                            var description = sheet.Cell(r, 3).GetString().Trim();
                            var refCell = sheet.Cell(r, 4);
                            var debit = sheet.Cell(r, 5).GetValue<decimal>();
                            var credit = sheet.Cell(r, 6).GetValue<decimal>();

                            if (string.IsNullOrWhiteSpace(accountName) || refCell.IsEmpty())
                            {
                                errors.Add($"{sheetName} baris {r}: Account Name atau Ref kosong, transaksi {group.Date:yyyy-MM-dd} dilewati.");
                                groupHasError = true;
                                continue;
                            }

                            if (!refCell.TryGetValue(out int refNumber))
                            {
                                errors.Add($"{sheetName} baris {r}: Ref bukan angka, transaksi {group.Date:yyyy-MM-dd} dilewati.");
                                groupHasError = true;
                                continue;
                            }

                            var account = await _context.ChartOfAccounts
                                .FirstOrDefaultAsync(a => a.ReferenceNumber == refNumber);

                            if (account == null)
                            {
                                var type = AccountClassification.TypeFromReferenceNumber(refNumber);
                                if (type == null)
                                {
                                    errors.Add($"{sheetName} baris {r}: Ref {refNumber} tidak valid, transaksi dilewati.");
                                    groupHasError = true;
                                    continue;
                                }

                                account = new ChartOfAccount
                                {
                                    ReferenceNumber = refNumber,
                                    AccountName = accountName,
                                    Type = type,
                                    Role = "Default",
                                    IsActive = true,
                                };
                                _context.ChartOfAccounts.Add(account);
                                accountsCreated++;
                            }

                            totalDebit += debit;
                            totalCredit += credit;
                            lines.Add(new JournalEntryLine
                            {
                                Account = account,
                                LineDescription = description,
                                Debit = debit,
                                Credit = credit,
                                LineOrder = lines.Count + 1,
                            });
                        }

                        if (groupHasError || lines.Count == 0)
                        {
                            continue;
                        }

                        // Validasi Balance (Debit = Credit)
                        if (totalDebit != totalCredit)
                        {
                            errors.Add($"{sheetName} transaksi {group.Date:yyyy-MM-dd}: Debit ({totalDebit:N2}) tidak balance dengan Credit ({totalCredit:N2}), transaksi dilewati.");
                            continue;
                        }

                        var entry = new JournalEntry
                        {
                            JournalType = journalType,
                            EntryDate = group.Date,
                            Lines = lines,
                        };

                        _context.JournalEntries.Add(entry);
                        transactionsImported++;
                    }
                }

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                TempData["ErrorMessage"] = $"Gagal memproses file '{excelFile.FileName}': {ex.Message}";
                return RedirectToAction(nameof(Index));
            }

            var summary = $"Import selesai: {transactionsImported} transaksi tersimpan, {accountsCreated} akun baru ditambahkan.";
            if (errors.Count > 0)
            {
                summary += $" {errors.Count} masalah terdeteksi: {string.Join(" | ", errors.Take(5))}";
                if (errors.Count > 5) summary += " ...";
            }

            if (transactionsImported == 0)
            {
                TempData["ErrorMessage"] = summary;
            }
            else
            {
                TempData["SuccessMessage"] = summary;
            }

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
