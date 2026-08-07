namespace AumoFinance.Models
{
    public class CashFlowLine
    {
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    // Laporan Arus Kas metode langsung (IAS 7). Setiap mutasi akun berperan
    // CashAndEquivalents diklasifikasikan berdasarkan tipe akun lawan pada
    // baris jurnal yang sama: Operasi (akun nominal & liabilitas jangka
    // pendek), Investasi (akun Assets non-kas), Pendanaan (Liabilities
    // jangka panjang/Equity, mis. modal atau dividen).
    public class CashFlowStatementViewModel
    {
        public decimal BeginningCash { get; set; }
        public List<CashFlowLine> OperatingActivities { get; set; } = new();
        public List<CashFlowLine> InvestingActivities { get; set; } = new();
        public List<CashFlowLine> FinancingActivities { get; set; } = new();

        public decimal NetOperating => OperatingActivities.Sum(l => l.Amount);
        public decimal NetInvesting => InvestingActivities.Sum(l => l.Amount);
        public decimal NetFinancing => FinancingActivities.Sum(l => l.Amount);
        public decimal NetChangeInCash => NetOperating + NetInvesting + NetFinancing;
        public decimal EndingCash => BeginningCash + NetChangeInCash;
    }
}
