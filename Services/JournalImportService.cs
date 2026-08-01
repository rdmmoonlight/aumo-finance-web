using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using ExcelDataReader; // Install via NuGet: ExcelDataReader & ExcelDataReader.DataSet
using YourProject.Models.DTOs;

namespace YourProject.Services
{
    public class JournalImportService : IJournalImportService
    {
        public async Task<JournalImportResultDto> ReadJournalExcelAsync(IFormFile file)
        {
            var result = new JournalImportResultDto();

            if (file == null || file.Length == 0)
            {
                result.IsSuccess = false;
                result.Message = "File Excel kosong atau tidak terdeteksi.";
                return result;
            }

            // Register provider encoding untuk support file .xlsx
            System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);

            try
            {
                using var stream = new MemoryStream();
                await file.CopyToAsync(stream);
                stream.Position = 0;

                using var reader = ExcelReaderFactory.CreateReader(stream);
                var dataSet = reader.AsDataSet();

                // Iterasi setiap Sheet (Mendukung GJ dan AJ)
                foreach (System.Data.DataTable table in dataSet.Tables)
                {
                    string sheetName = table.TableName.Trim().ToUpper();
                    string journalType = sheetName.Contains("AJ") ? "AJ" : "GJ";

                    JournalTransactionImportDto? currentTransaction = null;
                    DateTime? lastValidDate = null;

                    // Baris 1-3 dianggap Title/Header Info. Header tabel di Baris index 3 (Row 4 di Excel)
                    int startRow = 4; 

                    for (int rowIdx = startRow; rowIdx < table.Rows.Count; rowIdx++)
                    {
                        var row = table.Rows[rowIdx];

                        // Ambil mentah per kolom
                        string? dateRaw = GetValueOrNull(row[0]);
                        string? accountName = GetValueOrNull(row[1]);
                        string? description = GetValueOrNull(row[2]);
                        string? refCode = GetValueOrNull(row[3]);
                        decimal? debit = ParseDecimalOrNull(row[4]);
                        decimal? credit = ParseDecimalOrNull(row[5]);

                        // Jika seluruh baris kosong, abaikan / skip
                        if (dateRaw == null && accountName == null && description == null && 
                            refCode == null && debit == null && credit == null)
                        {
                            continue;
                        }

                        // Parse Tanggal jika ada di baris ini
                        DateTime? rowDate = ParseDateOrNull(dateRaw);

                        // LOGIKA PERPINDAHAN TRANSAKSI (Grup berdasarkan Tanggal Pertama)
                        if (rowDate.HasValue)
                        {
                            // Tanggal baru ditemukan -> Buat Transaksi Baru
                            lastValidDate = rowDate.Value;
                            currentTransaction = new JournalTransactionImportDto
                            {
                                Date = lastValidDate.Value,
                                JournalType = journalType
                            };
                            result.Transactions.Add(currentTransaction);
                        }
                        else if (currentTransaction == null && lastValidDate.HasValue)
                        {
                            // Baris lanjutan tanpa tanggal -> Sambung ke transaksi aktif sebelumnya
                            currentTransaction = new JournalTransactionImportDto
                            {
                                Date = lastValidDate.Value,
                                JournalType = journalType
                            };
                            result.Transactions.Add(currentTransaction);
                        }

                        // Jika tetap tidak ada tanggal sama sekali di awal baris
                        if (currentTransaction == null)
                        {
                            result.Warnings.Add($"Baris ke-{rowIdx + 1} di sheet '{table.TableName}' diabaikan karena tidak memiliki tanggal transaksi awal.");
                            continue;
                        }

                        // Tambahkan detail baris (Line Debit / Kredit)
                        var line = new JournalLineImportDto
                        {
                            RowIndex = rowIdx + 1,
                            AccountName = accountName,
                            Description = description,
                            Ref = refCode,
                            Debit = debit,   // Akan null jika kolom kosong di Excel
                            Credit = credit  // Akan null jika kolom kosong di Excel
                        };

                        currentTransaction.Lines.Add(line);
                        result.TotalLinesRead++;
                    }
                }

                result.TotalTransactionsRead = result.Transactions.Count;
                result.IsSuccess = true;
                result.Message = $"Berhasil membaca {result.TotalTransactionsRead} transaksi ({result.TotalLinesRead} baris detail).";
            }
            catch (Exception ex)
            {
                result.IsSuccess = false;
                result.Message = $"Gagal memproses file Excel: {ex.Message}";
            }

            return result;
        }

        #region Helper Parsing Nilai Nullable

        private string? GetValueOrNull(object obj)
        {
            if (obj == null || obj == DBNull.Value) return null;
            string str = obj.ToString()?.Trim() ?? string.Empty;
            return string.IsNullOrWhiteSpace(str) ? null : str;
        }

        private decimal? ParseDecimalOrNull(object obj)
        {
            if (obj == null || obj == DBNull.Value) return null;
            
            string str = obj.ToString()?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(str)) return null;

            if (decimal.TryParse(str, out decimal value))
            {
                return value;
            }
            return null;
        }

        private DateTime? ParseDateOrNull(string? dateStr)
        {
            if (string.IsNullOrWhiteSpace(dateStr)) return null;

            if (DateTime.TryParse(dateStr, out DateTime parsedDate))
            {
                return parsedDate;
            }
            
            // Handle jika angka serial date Excel
            if (double.TryParse(dateStr, out double oaDate))
            {
                return DateTime.FromOADate(oaDate);
            }

            return null;
        }

        #endregion
    }
}
