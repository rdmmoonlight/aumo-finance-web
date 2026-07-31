using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AumoFinance.Models
{
    // Baris jurnal untuk MobileJournalEntry Mode = "Manual". Akun sudah
    // dipilih langsung oleh pengguna di aplikasi Android; disimpan di sini
    // dulu (bukan JournalEntryLines) sampai diverifikasi/disetujui di web.
    public class MobileJournalEntryLine
    {
        public int Id { get; set; }

        [Required]
        public int MobileJournalEntryId { get; set; }

        [ForeignKey(nameof(MobileJournalEntryId))]
        public MobileJournalEntry? MobileJournalEntry { get; set; }

        [Required]
        public int AccountId { get; set; }

        [ForeignKey(nameof(AccountId))]
        public ChartOfAccount? Account { get; set; }

        [StringLength(250)]
        public string? LineDescription { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Debit { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Credit { get; set; }

        public int LineOrder { get; set; }
    }
}
