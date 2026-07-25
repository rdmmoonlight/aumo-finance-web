namespace AumoFinance.Models
{
    // Satu baris Neraca Saldo per akun. Dipakai bersama oleh Trial Balance
    // (hanya JournalType "General") dan Adjusted Trial Balance (General +
    // Adjusting), supaya logika penyajian tetap konsisten.
    public class TrialBalanceRow
    {
        public int AccountId { get; set; }
        public int ReferenceNumber { get; set; } = 0;
        public string AccountName { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool NormalBalanceIsDebit { get; set; }

        // Saldo bersih akun (mengikuti sisi normal). Bisa negatif bila
        // saldo akun berlawanan dari sisi normalnya.
        public decimal NetBalance { get; set; }

        // Nilai yang tampil di kolom Debit/Kredit Neraca Saldo. Bila saldo
        // berlawanan arah dari sisi normalnya, otomatis dipindah ke sisi
        // yang sesuai supaya total Debit = total Kredit tetap terjaga.
        public decimal Debit => NetBalance >= 0
            ? (NormalBalanceIsDebit ? NetBalance : 0)
            : (NormalBalanceIsDebit ? 0 : -NetBalance);

        public decimal Credit => NetBalance >= 0
            ? (NormalBalanceIsDebit ? 0 : NetBalance)
            : (NormalBalanceIsDebit ? -NetBalance : 0);
    }

    public class TrialBalanceViewModel
    {
        public string Title { get; set; } = string.Empty;
        public List<TrialBalanceRow> Rows { get; set; } = new();
        public decimal TotalDebit => Rows.Sum(r => r.Debit);
        public decimal TotalCredit => Rows.Sum(r => r.Credit);
        public bool IsBalanced => Math.Round(TotalDebit - TotalCredit, 2) == 0;
    }
}
