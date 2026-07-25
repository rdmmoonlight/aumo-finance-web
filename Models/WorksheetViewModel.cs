namespace AumoFinance.Models
{
    // Worksheet akuntansi 10 kolom: Neraca Saldo (belum disesuaikan),
    // Penyesuaian, Neraca Saldo Disesuaikan, Laporan Laba Rugi, dan
    // Laporan Posisi Keuangan. Setiap baris mewakili satu akun aktif.
    public class WorksheetRow
    {
        public int AccountId { get; set; }
        public int ReferenceNumber { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public bool NormalBalanceIsDebit { get; set; }

        public decimal UnadjustedDebit { get; set; }
        public decimal UnadjustedCredit { get; set; }

        public decimal AdjustmentDebit { get; set; }
        public decimal AdjustmentCredit { get; set; }

        public decimal AdjustedDebit { get; set; }
        public decimal AdjustedCredit { get; set; }

        public decimal IncomeStatementDebit { get; set; }
        public decimal IncomeStatementCredit { get; set; }

        public decimal FinancialPositionDebit { get; set; }
        public decimal FinancialPositionCredit { get; set; }
    }

    public class WorksheetViewModel
    {
        public List<WorksheetRow> Rows { get; set; } = new();
        public decimal NetIncome { get; set; }

        public decimal TotalUnadjustedDebit => Rows.Sum(r => r.UnadjustedDebit);
        public decimal TotalUnadjustedCredit => Rows.Sum(r => r.UnadjustedCredit);

        public decimal TotalAdjustmentDebit => Rows.Sum(r => r.AdjustmentDebit);
        public decimal TotalAdjustmentCredit => Rows.Sum(r => r.AdjustmentCredit);

        public decimal TotalAdjustedDebit => Rows.Sum(r => r.AdjustedDebit);
        public decimal TotalAdjustedCredit => Rows.Sum(r => r.AdjustedCredit);

        public decimal TotalIncomeStatementDebit => Rows.Sum(r => r.IncomeStatementDebit);
        public decimal TotalIncomeStatementCredit => Rows.Sum(r => r.IncomeStatementCredit);

        public decimal TotalFinancialPositionDebit => Rows.Sum(r => r.FinancialPositionDebit);
        public decimal TotalFinancialPositionCredit => Rows.Sum(r => r.FinancialPositionCredit);
    }
}
