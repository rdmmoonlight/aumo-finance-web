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
        public string JournalType { get; set; } = "General"; // "General" atau "Adjusting"

        [Required]
        public DateTime EntryDate { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<JournalEntryLine> Lines { get; set; } = new();

        public decimal TotalDebit => Lines.Sum(l => l.Debit);
        public decimal TotalCredit => Lines.Sum(l => l.Credit);
    }
}
