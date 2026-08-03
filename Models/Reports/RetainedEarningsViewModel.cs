namespace AumoFinance.Models
{
    // Retained Earnings Statement: bridges the Income Statement with the
    // Equity section on the Balance Sheet (US GAAP / ASC 210).
    public class RetainedEarningsViewModel
    {
        public string AccountName { get; set; } = "Retained Earnings";
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal BeginningBalance { get; set; }
        public decimal NetIncome { get; set; }
        public decimal Dividends { get; set; }
        public decimal EndingBalance => BeginningBalance + NetIncome - Dividends;
    }
}
