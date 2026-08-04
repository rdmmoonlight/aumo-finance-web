namespace AumoFinance.Models
{
    public class MobileJournalEntryLine
    {
        public int Id { get; set; }
        public int MobileJournalEntryId { get; set; }
        public int AccountId { get; set; }
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        public string? Description { get; set; }

        // Navigation Properties untuk Entity Framework
        public MobileJournalEntry? MobileJournalEntry { get; set; }
        public ChartOfAccount? Account { get; set; }
    }
}
