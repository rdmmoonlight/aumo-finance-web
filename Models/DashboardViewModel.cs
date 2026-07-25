using System;
using System.Collections.Generic;

// PASTIKAN TULISANNYA AumoFinance.Models
namespace AumoFinance.Models 
{
    public class DashboardViewModel
    {
        public decimal TotalKasBank { get; set; }
        public decimal PendapatanBulanIni { get; set; }
        public decimal BebanOperasional { get; set; }
        public decimal LabaBersih { get; set; }
        
        public List<string> ChartLabels { get; set; } = new();
        public List<decimal> ChartPendapatan { get; set; } = new();
        public List<decimal> ChartBeban { get; set; } = new();
        
        public List<JournalEntryDto> RecentJournals { get; set; } = new();
        public List<CoaBalanceDto> MainCoaBalances { get; set; } = new();
    }

    public class JournalEntryDto
    {
        public string ReferenceNo { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string Memo { get; set; } = string.Empty;
        public decimal TotalDebit { get; set; }
        public decimal TotalCredit { get; set; }
    }

    public class CoaBalanceDto
    {
        public string AccountCode { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public decimal Balance { get; set; }
    }
}