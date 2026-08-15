using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;

namespace AumoFinance.Models
{
    public class JournalEntry
    {
        public int Id { get; set; }

        // Pemilik jurnal ini — setiap user punya buku besar sendiri.
        public Guid UserId { get; set; }

        [Required]
        [StringLength(30)]
        public string TransactionNumber { get; set; } = string.Empty;

        [Required]
        [StringLength(50)]
        public string JournalType { get; set; } = "General"; // "General" atau "Adjusting"

        [Required]
        public DateTime EntryDate { get; set; }

        // Menggunakan DateTime.Now (atau biarkan diisi otomatis oleh database/request)
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public List<JournalEntryLine> Lines { get; set; } = new();

        public decimal TotalDebit => Lines.Sum(l => l.Debit);
        public decimal TotalCredit => Lines.Sum(l => l.Credit);
    }
}
