namespace AumoFinance.Models
{
    public class IncomeStatementLine
    {
        public int ReferenceNumber { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    // Format IAS 1 (Statement of Profit or Loss) untuk laporan keuangan
    // pribadi: Pendapatan dikurangi Beban Usaha menjadi Laba Usaha, lalu
    // ditambah/kurang Pendapatan & Beban Lain-lain menjadi Laba Bersih.
    // Tidak ada Beban Pokok Penjualan (COGS) / Laba Bruto karena tidak
    // relevan untuk entitas non-dagang.
    public class IncomeStatementViewModel
    {
        public DateTime AsOfDate { get; set; }

        public List<IncomeStatementLine> Revenues { get; set; } = new();
        public List<IncomeStatementLine> OperatingExpenses { get; set; } = new();
        public List<IncomeStatementLine> OtherIncome { get; set; } = new();
        public List<IncomeStatementLine> OtherExpenses { get; set; } = new();

        public decimal TotalRevenue => Revenues.Sum(l => l.Amount);
        public decimal TotalOperatingExpenses => OperatingExpenses.Sum(l => l.Amount);
        public decimal OperatingIncome => TotalRevenue - TotalOperatingExpenses;

        public decimal TotalOtherIncome => OtherIncome.Sum(l => l.Amount);
        public decimal TotalOtherExpenses => OtherExpenses.Sum(l => l.Amount);

        public decimal NetIncome => OperatingIncome + TotalOtherIncome - TotalOtherExpenses;
    }
}
