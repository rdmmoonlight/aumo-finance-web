namespace AumoFinance.Models
{
    public class FinancialPositionLine
    {
        public int ReferenceNumber { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    // Format IAS 1 (Statement of Financial Position). Saldo Laba yang
    // ditampilkan adalah saldo akhir dari Retained Earnings Statement
    // (saldo awal + laba/rugi periode berjalan), bukan saldo mentah akun
    // Retained Earnings di ledger — karena penutupan buku belum diposting.
    public class StatementOfFinancialPositionViewModel
    {
        public DateTime AsOfDate { get; set; }
        public bool IsPostClosing { get; set; }

        public List<FinancialPositionLine> Assets { get; set; } = new();
        public List<FinancialPositionLine> Liabilities { get; set; } = new();
        public List<FinancialPositionLine> EquityExcludingRetainedEarnings { get; set; } = new();
        public decimal RetainedEarningsEnding { get; set; }

        public decimal TotalAssets => Assets.Sum(l => l.Amount);
        public decimal TotalLiabilities => Liabilities.Sum(l => l.Amount);
        public decimal TotalEquity => EquityExcludingRetainedEarnings.Sum(l => l.Amount) + RetainedEarningsEnding;
        public decimal TotalLiabilitiesAndEquity => TotalLiabilities + TotalEquity;
        public bool IsBalanced => Math.Round(TotalAssets - TotalLiabilitiesAndEquity, 2) == 0;
    }
}
