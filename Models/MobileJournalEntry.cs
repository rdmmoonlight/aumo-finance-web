using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AumoFinance.Models
{
    // Tabel terpisah untuk SEMUA input dari Android. Tidak pernah langsung
    // menyentuh JournalEntries/JournalEntryLines. Baru dipindahkan ke tabel
    // utama setelah diverifikasi lewat halaman web "Mobile Classification".
    public class MobileJournalEntry
    {
        public int Id { get; set; }

        [Required]
        public DateTime EntryDate { get; set; }

        // "Simple"  = input cepat Income/Expense tanpa pilih akun (perlu
        //             diklasifikasikan ke akun yang benar saat verifikasi).
        // "Manual"  = jurnal multi-baris, akun sudah dipilih sendiri oleh
        //             pengguna di aplikasi Android (verifikasi = approve).
        [Required]
        [StringLength(20)]
        public string Mode { get; set; } = "Simple";

        // Hanya dipakai untuk Mode = "Simple": "Income" atau "Expense".
        [StringLength(20)]
        public string? Type { get; set; }

        // Hanya dipakai untuk Mode = "Simple". Untuk Mode = "Manual",
        // nominal dihitung dari total baris (Lines).
        [Column(TypeName = "decimal(18,2)")]
        public decimal? Amount { get; set; }

        public string? Note { get; set; }

        // "Pending" | "Verified" | "Rejected"
        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Pending";

        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

        public DateTime? VerifiedAt { get; set; }

        public DateTime? RejectedAt { get; set; }

        // Diisi setelah verifikasi berhasil: id JournalEntry hasil gabungan
        // di tabel utama. Tetap null selama status Pending/Rejected.
        public int? VerifiedJournalEntryId { get; set; }

        [ForeignKey(nameof(VerifiedJournalEntryId))]
        public JournalEntry? VerifiedJournalEntry { get; set; }

        // Hanya terisi untuk Mode = "Manual" (akun sudah dipilih di app).
        public List<MobileJournalEntryLine> Lines { get; set; } = new();

        [NotMapped]
        public decimal TotalAmount => Mode == "Manual" ? Lines.Sum(l => l.Debit) : (Amount ?? 0);
    }
}
