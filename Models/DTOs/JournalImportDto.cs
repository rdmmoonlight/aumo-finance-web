using System;
using System.Collections.Generic;

namespace AumoFinance.Models.DTOs
{
    public class JournalTransactionImportDto
    {
        public DateTime Date { get; set; }
        public string JournalType { get; set; } = "General";
        public List<JournalLineImportDto> Lines { get; set; } = new();
    }

    public class JournalLineImportDto
    {
        public int RowIndex { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int RefNumber { get; set; }
        public decimal? Debit { get; set; }  // Null jika sel Excel kosong
        public decimal? Credit { get; set; } // Null jika sel Excel kosong
    }

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
