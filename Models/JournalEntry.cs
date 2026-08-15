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

        // Tanggal transaksi — diisi manual oleh user lewat date picker.
        // Hanya tanggal (tanpa jam) yang relevan di sini.
        [Required]
        public DateTime EntryDate { get; set; }

        // Waktu pencatatan — diisi otomatis oleh database (kolom
        // "timestamp with time zone" dengan default now()) saat baris
        // dimasukkan. Jangan di-set dari kode aplikasi; biarkan default
        // CLR (kosong) agar EF Core tidak mengirim nilai ini di INSERT
        // dan server database yang mengisinya, lengkap tanggal + jam.
        public DateTime CreatedAt { get; set; }

        public List<JournalEntryLine> Lines { get; set; } = new();

        public decimal TotalDebit => Lines.Sum(l => l.Debit);
        public decimal TotalCredit => Lines.Sum(l => l.Credit);
    }
}
