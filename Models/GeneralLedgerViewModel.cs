namespace AumoFinance.Models
{
    // Satu kartu ledger per akun. Baris-barisnya diambil langsung dari
    // JournalEntryLine (yang diinput lewat Journal Entry), sehingga General
    // Ledger tidak pernah "lepas" dari General Journal.
    public class LedgerAccountViewModel
    {
        public int AccountId { get; set; }
        public int ReferenceNumber { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public bool NormalBalanceIsDebit { get; set; }
        public List<LedgerLineViewModel> Lines { get; set; } = new();
        public decimal EndingBalance { get; set; }
    }

    public class LedgerLineViewModel
    {
        public DateTime EntryDate { get; set; }
        public string ReferenceNumber { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        public decimal RunningBalance { get; set; }
    }
}
