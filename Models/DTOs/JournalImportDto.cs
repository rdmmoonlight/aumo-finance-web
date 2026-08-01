using System;
using System.Collections.Generic;

namespace YourProject.Models.DTOs
{
    // Model untuk menampung 1 Header Jurnal (Grouped by Transaction)
    public class JournalTransactionImportDto
    {
        public DateTime Date { get; set; }
        public string JournalType { get; set; } = "GJ"; // "GJ" atau "AJ"
        public List<JournalLineImportDto> Lines { get; set; } = new();
    }

    // Model untuk setiap baris detail (Debit / Kredit)
    public class JournalLineImportDto
    {
        public int RowIndex { get; set; }
        public string? AccountName { get; set; }
        public string? Description { get; set; }
        public string? Ref { get; set; } // Kode Akun / COA Code
        public decimal? Debit { get; set; }  // Nullable, jika kosong = null
        public decimal? Credit { get; set; } // Nullable, jika kosong = null
        
        // Helper property untuk mengetahui tipe baris
        public bool IsDebit => Debit.HasValue && Debit.Value > 0;
        public bool IsCredit => Credit.HasValue && Credit.Value > 0;
    }

    // Model Response/Result setelah pembacaan Excel
    public class JournalImportResultDto
    {
        public bool IsSuccess { get; set; }
        public string Message { get; set; } = string.Empty;
        public int TotalTransactionsRead { get; set; }
        public int TotalLinesRead { get; set; }
        public List<JournalTransactionImportDto> Transactions { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
    }
}
