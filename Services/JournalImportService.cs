using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using ClosedXML.Excel;
using AumoFinance.Models.DTOs;

namespace AumoFinance.Services
{
    public class JournalImportService : IJournalImportService
    {
        public async Task<JournalImportResultDto> ReadJournalExcelAsync(IFormFile file)
        {
            var result = new JournalImportResultDto();

            if (file == null || file.Length == 0)
            {
                result.IsSuccess = false;
                result.Message = "File Excel tidak ditemukan atau kosong.";
                return result;
            }

            try
            {
                using var stream = new MemoryStream();
                await file.CopyToAsync(stream);
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

                        if (dateCell.IsEmpty() && accountCell.IsEmpty() && refCell.IsEmpty())
                            continue;

                        // Grouping Tanggal
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

                        if (currentTx == null)
                        {
                            result.Warnings.Add($"{sheetName} Baris {r}: Baris diabaikan karena tidak ada tanggal awal transaksi.");
                            continue;
                        }

                        // Nullable Debit / Credit
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
                            Credit = creditValue
                        });

                        result.TotalLinesRead++;
                    }
                }

                result.TotalTransactionsRead = result.Transactions.Count;
                result.IsSuccess = true;
                result.Message = $"Berhasil membaca {result.TotalTransactionsRead} transaksi.";
            }
            catch (Exception ex)
            {
                result.IsSuccess = false;
                result.Message = $"Gagal membaca file Excel: {ex.Message}";
            }

            return result;
        }
    }
}
