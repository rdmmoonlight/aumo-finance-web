using System;
using System.Collections.Generic;
using System.Linq; // Tambahkan namespace System.Linq

namespace AumoFinance.Models
{
    public class DashboardViewModel
    {
        public decimal TotalCashAndEquivalents { get; set; }
        public decimal RevenueThisPeriod { get; set; }
        public decimal OperatingExpenses { get; set; }
        public decimal NetIncome { get; set; }
        public decimal TotalAssets { get; set; }
        public decimal TotalLiabilities { get; set; }

        // Trend percentages
        public decimal? CashTrendPercent { get; set; }
        public decimal? RevenueTrendPercent { get; set; }
        public decimal? ExpenseTrendPercent { get; set; }
        public decimal? NetIncomeTrendPercent { get; set; }

        // Properti Predictive & Financial Health Metrics
        public decimal MonthlyBurnRate { get; set; }
        public double CashRunwayMonths { get; set; }
        public int FinancialHealthScore { get; set; }

        public List<string> ChartLabels { get; set; } = new();
        public List<decimal> ChartRevenue { get; set; } = new();
        public List<decimal> ChartExpenses { get; set; } = new();

        public List<string> ExpenseCategoryLabels { get; set; } = new();
        public List<decimal> ExpenseCategoryValues { get; set; } = new();

        // TAMBAHKAN PROPERTI INI:
        public bool HasExpenseData => ExpenseCategoryValues != null && ExpenseCategoryValues.Any(v => v > 0);

        public List<JournalEntryDto> RecentJournals { get; set; } = new();
        public List<CoaBalanceDto> MainCoaBalances { get; set; } = new();

        public string ActivePeriodName { get; set; } = "No Active Period";
        public DateTime? ActivePeriodStart { get; set; }
        public DateTime? ActivePeriodEnd { get; set; }
    }

    public class JournalEntryDto
    {
        public DateTime Date { get; set; }
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
