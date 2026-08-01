using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

        // ==========================================
        // TEMPLATE DOWNLOAD (ClosedXML)
        // ==========================================

        public IActionResult DownloadJournalTemplate()
        {
            using var workbook = new XLWorkbook();

            BuildJournalSheetTemplate(
                workbook,
                sheetName: "GJ",
                rows: new[]
                {
                    (Account: "Cash on Hand", Desc: "Penerimaan penjualan tunai", Ref: 101, Debit: (decimal?)500000m, Credit: (decimal?)null),
                    (Account: "Sales Revenue", Desc: "Penerimaan penjualan tunai", Ref: 401, Debit: (decimal?)null, Credit: (decimal?)300000m),
                    (Account: "Service Revenue", Desc: "Penerimaan penjualan tunai", Ref: 402, Debit: (decimal?)null, Credit: (decimal?)200000m),
                });

            BuildJournalSheetTemplate(
                workbook,
                sheetName: "AJ",
                rows: new[]
                {
                    (Account: "Depreciation Expense", Desc: "Penyesuaian penyusutan bulanan", Ref: 501, Debit: (decimal?)100000m, Credit: (decimal?)null),
                    (Account: "Accumulated Depreciation", Desc: "Penyesuaian penyusutan bulanan", Ref: 151, Debit: (decimal?)null, Credit: (decimal?)100000m),
                });

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            var content = stream.ToArray();

            return File(
                content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "JournalImportTemplate.xlsx");
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
                // Cetak tanggal HANYA di baris pertama transaksi
                if (isFirstRowOfTransaction)
                {
                    sheet.Cell(row, 1).Value = exampleDate;
                    isFirstRowOfTransaction = false;
                }

                sheet.Cell(row, 2).Value = r.Account;
                sheet.Cell(row, 3).Value = r.Desc;
                sheet.Cell(row, 4).Value = r.Ref;

                // Tulis angka jika ada, kosongkan (null) jika null
                if (r.Debit.HasValue) sheet.Cell(row, 5).Value = r.Debit.Value;
                if (r.Credit.HasValue) sheet.Cell(row, 6).Value = r.Credit.Value;

                row++;
            }

            sheet.Range(2, 1, row - 1, 1).Style.DateFormat.Format = "yyyy-mm-dd";
            sheet.Columns().AdjustToContents();
        }

        // ==========================================
        // IMPORT JOURNAL (TANPA VALIDASI BALANCE & NULL HANDLING)
        // ==========================================

        [HttpPost]
        public async Task<IActionResult> ImportJournal(IFormFile excelFile)
        {
            if (excelFile == null || excelFile.Length == 0)
            {
                TempData["ErrorMessage"] = "Excel file tidak ditemukan atau kosong.";
                return RedirectToAction(nameof(Index));
            }

            var parseResult = ParseJournalExcel(excelFile);

            if (!parseResult.IsSuccess)
            {
                TempData["ErrorMessage"] = parseResult.Message;
                return RedirectToAction(nameof(Index));
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
                        // 1. Cek COA berdasarkan Ref
                        var account = await _context.ChartOfAccounts
                            .FirstOrDefaultAsync(a => a.ReferenceNumber == lineDto.RefNumber);

                        // Auto-create COA jika belum ada
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

                        // 2. Map ke Line Entity (Debit / Credit bernilai 0 jika null di DB)
                        entryLines.Add(new JournalEntryLine
                        {
                            Account = account,
                            LineDescription = lineDto.Description,
                            Debit = lineDto.Debit ?? 0m,
                            Credit = lineDto.Credit ?? 0m,
                            LineOrder = entryLines.Count + 1
                        });
                    }

                    // 3. Buat Journal Entry (Tanpa Cek Total Debit == Total Credit / No Balance Check)
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

                string message = $"Import sukses: {transactionsImported} transaksi tersimpan, {accountsCreated} akun COA baru otomatis dibuat.";
                if (parseResult.Warnings.Count > 0)
                {
                    message += $" ({parseResult.Warnings.Count} peringatan terdeteksi)";
                }

                TempData["SuccessMessage"] = message;
            }
            catch (Exception ex)
            {
                TempData["ErrorMessage"] = $"Terjadi kesalahan saat menyimpan ke database: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // Private Parser Method menggunakan ClosedXML
        private JournalImportResultDto ParseJournalExcel(IFormFile excelFile)
        {
            var result = new JournalImportResultDto();

            try
            {
                using var stream = new MemoryStream();
                excelFile.CopyTo(stream);
                stream.Position = 0;

                using var workbook = new XLWorkbook(stream);

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

                        // Baris kosong diabaikan
                        if (dateCell.IsEmpty() && accountCell.IsEmpty() && refCell.IsEmpty())
                            continue;

                        // --- 1. HANDLING TANGGAL & GROUPING TRANSAKSI ---
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
                                result.Warnings.Add($"{sheetName} Baris {r}: Format tanggal tidak valid.");
                                continue;
                            }
                        }

                        // Jika baris tidak punya tanggal, masuk ke transaksi aktif terakhir
                        if (currentTx == null)
                        {
                            result.Warnings.Add($"{sheetName} Baris {r}: Baris diabaikan karena tidak berada di bawah tanggal transaksi.");
                            continue;
                        }

                        // --- 2. HANDLING VALUE NULL PADA DEBIT/CREDIT ---
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

                        // Parse Ref
                        refCell.TryGetValue(out int refNum);

                        // --- 3. MASUKKAN LINE KE TRANSAKSI ---
                        var line = new JournalLineImportDto
                        {
                            RowIndex = r,
                            AccountName = accountCell.GetString().Trim(),
                            Description = descCell.GetString().Trim(),
                            RefNumber = refNum,
                            Debit = debitValue,   // Bernilai NULL jika sel Excel kosong
                            Credit = creditValue  // Bernilai NULL jika sel Excel kosong
                        };

                        currentTx.Lines.Add(line);
                        result.TotalLinesRead++;
                    }
                }

                result.TotalTransactionsRead = result.Transactions.Count;
                result.IsSuccess = true;
            }
            catch (Exception ex)
            {
                result.IsSuccess = false;
                result.Message = $"Gagal membaca Excel: {ex.Message}";
            }

            return result;
        }

        // ==========================================
        // OTHER SYSTEM OPERATIONS
        // ==========================================

        [HttpPost]
        public IActionResult MonthEndClose(string period)
        {
            if (string.IsNullOrEmpty(period))
            {
                TempData["ErrorMessage"] = "Bulan dan tahun harus diisi.";
                return RedirectToAction(nameof(Index));
            }

            TempData["SuccessMessage"] = $"Tutup buku periode {period} berhasil disimulasikan.";
            return RedirectToAction(nameof(Index));
        }

        public IActionResult RecalculateLedger()
        {
            TempData["SuccessMessage"] = "Kalkulasi ulang saldo buku besar berhasil dilaksanakan.";
            return RedirectToAction(nameof(Index));
        }

        public async Task<IActionResult> BackupDatabase()
        {
            using var workbook = new XLWorkbook();

            var accounts = await _context.ChartOfAccounts.OrderBy(a => a.ReferenceNumber).ToListAsync();
            var entries = await _context.JournalEntries.Include(e => e.Lines).ThenInclude(l => l.Account).OrderBy(e => e.EntryDate).ToListAsync();
            var periods = await _context.Periods.OrderBy(p => p.StartDate).ToListAsync();

            BuildChartOfAccountsSheet(workbook, accounts);
            BuildJournalEntriesSheet(workbook, entries);
            BuildPeriodsSheet(workbook, periods);

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);

            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"AumoFinance_Export_{DateTime.Now:yyyyMMdd_HHmm}.xlsx");
        }

        private static void WriteHeaderRow(IXLWorksheet sheet, string[] headers)
        {
            for (int i = 0; i < headers.Length; i++)
            {
                var cell = sheet.Cell(1, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#212529");
                cell.Style.Font.FontColor = XLColor.White;
            }
        }

        private static void BuildChartOfAccountsSheet(XLWorkbook workbook, List<ChartOfAccount> accounts)
        {
            var sheet = workbook.Worksheets.Add("Chart of Accounts");
            WriteHeaderRow(sheet, new[] { "Ref", "Account Name", "Type", "Role", "Active" });

            int row = 2;
            foreach (var a in accounts)
            {
                sheet.Cell(row, 1).Value = a.ReferenceNumber;
                sheet.Cell(row, 2).Value = a.AccountName;
                sheet.Cell(row, 3).Value = a.Type;
                sheet.Cell(row, 4).Value = a.Role;
                sheet.Cell(row, 5).Value = a.IsActive ? "Yes" : "No";
                row++;
            }
            sheet.Columns().AdjustToContents();
        }

        private static void BuildJournalEntriesSheet(XLWorkbook workbook, List<JournalEntry> entries)
        {
            var sheet = workbook.Worksheets.Add("Journal Entries");
            WriteHeaderRow(sheet, new[] { "Date", "Type", "Entry Ref", "Account Ref", "Account Name", "Description", "Debit", "Credit" });

            int row = 2;
            foreach (var entry in entries)
            {
                foreach (var line in entry.Lines.OrderBy(l => l.LineOrder))
                {
                    sheet.Cell(row, 1).Value = entry.EntryDate;
                    sheet.Cell(row, 2).Value = entry.JournalType;
                    sheet.Cell(row, 3).Value = entry.ReferenceNumber;
                    sheet.Cell(row, 4).Value = line.Account?.ReferenceNumber;
                    sheet.Cell(row, 5).Value = line.Account?.AccountName;
                    sheet.Cell(row, 6).Value = line.LineDescription;
                    sheet.Cell(row, 7).Value = line.Debit;
                    sheet.Cell(row, 8).Value = line.Credit;
                    row++;
                }
            }

            if (row > 2) sheet.Range(2, 1, row - 1, 1).Style.DateFormat.Format = "yyyy-mm-dd";
            sheet.Columns().AdjustToContents();
        }

        private static void BuildPeriodsSheet(XLWorkbook workbook, List<Period> periods)
        {
            var sheet = workbook.Worksheets.Add("Periods");
            WriteHeaderRow(sheet, new[] { "Period Name", "Start Date", "End Date", "Status" });

            int row = 2;
            foreach (var p in periods)
            {
                sheet.Cell(row, 1).Value = p.PeriodName;
                sheet.Cell(row, 2).Value = p.StartDate;
                sheet.Cell(row, 3).Value = p.EndDate;
                sheet.Cell(row, 4).Value = p.IsClosed ? "Closed" : "Open";
                row++;
            }

            if (row > 2) sheet.Range(2, 2, row - 1, 3).Style.DateFormat.Format = "yyyy-mm-dd";
            sheet.Columns().AdjustToContents();
        }
    }
}
