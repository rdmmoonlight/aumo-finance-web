using System.ComponentModel.DataAnnotations;

namespace AumoFinance.Models
{
    public class JournalEntryCreateViewModel
    {
        [Required]
        public string JournalType { get; set; } = "General";

        [Required]
        [DataType(DataType.Date)]
        public DateTime EntryDate { get; set; } = DateTime.Today;

        public List<JournalEntryLineInputModel> Lines { get; set; } = new()
        {
            new JournalEntryLineInputModel(),
            new JournalEntryLineInputModel()
        };

        // Daftar akun aktif dari Chart of Account, dipakai untuk mengisi
        // dropdown "Account" di setiap baris jurnal. Setiap opsi menampilkan
        // Nomor Ref. COA secara otomatis (mis. "101 - Cash on Hand").
        public List<ChartOfAccount> AvailableAccounts { get; set; } = new();
    }

    public class JournalEntryLineInputModel
    {
        public int AccountId { get; set; }

        [StringLength(250)]
        public string? LineDescription { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? Debit { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? Credit { get; set; }
    }

    // Dipakai oleh JournalEntry/Edit. Mewarisi field yang sama dengan Create,
    // ditambah Id (entry yang diedit) dan TransactionNumber (ditampilkan
    // read-only, tidak diregenerasi ulang saat entry diedit).
    public class JournalEntryEditViewModel
    {
        public int Id { get; set; }

        public string TransactionNumber { get; set; } = string.Empty;

        [Required]
        public string JournalType { get; set; } = "General";

        [Required]
        [DataType(DataType.Date)]
        public DateTime EntryDate { get; set; } = DateTime.Today;

        public List<JournalEntryLineInputModel> Lines { get; set; } = new()
        {
            new JournalEntryLineInputModel(),
            new JournalEntryLineInputModel()
        };

        public List<ChartOfAccount> AvailableAccounts { get; set; } = new();
    }
}
