namespace AumoFinance.Models
{
    // Baris ringkasan untuk daftar transaksi mobile yang menunggu klasifikasi.
    public class MobileClassificationListItem
    {
        public int JournalEntryId { get; set; }
        public string ReferenceNumber { get; set; } = string.Empty;
        public DateTime EntryDate { get; set; }

        // "Income" atau "Expense", diambil dari posisi akun Unclassified.
        public string Type { get; set; } = string.Empty;

        public decimal Amount { get; set; }
        public string? MobileNote { get; set; }
    }

    // Data untuk halaman Classify (GET/POST per entry).
    public class MobileClassifyViewModel
    {
        public int JournalEntryId { get; set; }
        public string ReferenceNumber { get; set; } = string.Empty;
        public DateTime EntryDate { get; set; }

        // "Income" atau "Expense"
        public string Type { get; set; } = string.Empty;

        public decimal Amount { get; set; }
        public string? MobileNote { get; set; }

        // Baris yang masih menunjuk ke akun Unclassified; inilah yang akan
        // diganti AccountId-nya saat disimpan.
        public int UnclassifiedLineId { get; set; }

        public int SelectedAccountId { get; set; }
        public string? Description { get; set; }

        public List<ChartOfAccount> AvailableAccounts { get; set; } = new();
    }
}
