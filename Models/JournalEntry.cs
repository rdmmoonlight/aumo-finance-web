using System.ComponentModel.DataAnnotations;

namespace AumoFinance.Models
{
    public class JournalEntry
    {
        public int Id { get; set; }

        // Pemilik jurnal ini — setiap user punya buku besar sendiri.
        public Guid UserId { get; set; }

        [Required]
        [StringLength(30)]
        public string ReferenceNumber { get; set; } = string.Empty;

        [Required]
        public string JournalType { get; set; } = "General"; // "General" atau "Adjusting"

        [Required]
        public DateTime EntryDate { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Menandai jurnal yang dibuat lewat input cepat mobile dan masih
        // menunggu diklasifikasikan ke akun pendapatan/beban yang sesuai
        // lewat halaman admin "Mobile Classification".
        public bool NeedsClassification { get; set; } = false;

        // Asal input jurnal: "Mobile" | "Web" | null (data lama sebelum kolom ini ada).
        public string? Source { get; set; }

        // Catatan asli dari Android, dipakai sebagai draft deskripsi saat
        // diklasifikasikan di web (boleh diedit oleh admin).
        public string? MobileNote { get; set; }

        public List<JournalEntryLine> Lines { get; set; } = new();

        public decimal TotalDebit => Lines.Sum(l => l.Debit);
        public decimal TotalCredit => Lines.Sum(l => l.Credit);
    }
}
