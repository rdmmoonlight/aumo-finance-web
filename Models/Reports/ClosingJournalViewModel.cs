namespace AumoFinance.Models
{
    public class ClosingJournalLine
    {
        public int ReferenceNumber { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
    }

    public class ClosingJournalEntryGroup
    {
        public string Description { get; set; } = string.Empty;
        public List<ClosingJournalLine> Lines { get; set; } = new();
        public decimal TotalDebit => Lines.Sum(l => l.Debit);
        public decimal TotalCredit => Lines.Sum(l => l.Credit);
    }

    // Jurnal penutup dihitung langsung dari saldo akun nominal (tidak
    // disimpan ke database) — metode langsung ke Retained Earnings, tanpa
    // akun perantara Income Summary, karena COA tidak menyediakan peran
    // tersebut.
    public class ClosingJournalViewModel
    {
        public List<ClosingJournalEntryGroup> Groups { get; set; } = new();
        public decimal NetIncome { get; set; }
        public string RetainedEarningsAccountName { get; set; } = "Retained Earnings";
    }
}
