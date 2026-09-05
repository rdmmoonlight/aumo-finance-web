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
        public string JournalType { get; set; } = "General"; // "General", "Adjusting", atau "Closing"

        // "Closing" hanya dibuat sistem sendiri (lihat ClosingJournalPoster)
        // saat sebuah periode ditutup — tidak pernah diinput manual lewat
        // halaman Journal Entry.

        [Required]
        public DateTime EntryDate { get; set; }

        // Waktu pencatatan — diisi otomatis oleh sistem berdasarkan jam
        // dinding PERANGKAT pengguna saat entri diinput (bukan jam
        // server saat baris tersimpan ke database). Web: diambil lewat
        // JS interop (aumoTime.getLocalTimestamp). Mobile: dikirim oleh
        // client Android (DateTime.Now perangkat) di field CreatedAt.
        public DateTime CreatedAt { get; set; }

        // Waktu terakhir entri ini diedit — diisi otomatis dengan pola yang
        // sama seperti CreatedAt (jam dinding perangkat saat edit disimpan,
        // bukan jam server). Null selama entri belum pernah diedit sejak
        // dibuat (baru EntryDate + CreatedAt yang terisi).
        public DateTime? UpdatedAt { get; set; }

        public List<JournalEntryLine> Lines { get; set; } = new();

        public decimal TotalDebit => Lines.Sum(l => l.Debit);
        public decimal TotalCredit => Lines.Sum(l => l.Credit);
    }
}
