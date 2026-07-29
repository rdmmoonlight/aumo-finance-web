using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AumoFinance.Models
{
    public class JournalEntryLine
    {
        public int Id { get; set; }

        [Required]
        public int JournalEntryId { get; set; }

        [ForeignKey(nameof(JournalEntryId))]
        public JournalEntry? JournalEntry { get; set; }

        // Referensi langsung ke Chart of Account. Nomor referensi COA
        // (ChartOfAccount.ReferenceNumber) diambil lewat relasi ini,
        // bukan disalin manual, sehingga Journal Entry, General Journal,
        // General Ledger, dan General Ledger (Temporary Accounts) selalu
        // konsisten dengan satu sumber data yang sama.
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
