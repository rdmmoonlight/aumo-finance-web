namespace AumoFinance.Models
{
    // Laporan Saldo Laba: menjembatani Laporan Laba Rugi dengan bagian
    // Ekuitas di Laporan Posisi Keuangan (IAS 1 par. 106).
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
