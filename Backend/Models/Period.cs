using System;
using System.ComponentModel.DataAnnotations;

namespace AumoFinance.Models
{
    public class Period
    {
        [Key]
        public int Id { get; set; }

        // Pemilik periode ini — setiap user punya siklus periodenya sendiri.
        public Guid UserId { get; set; }

        [Required]
        [StringLength(100)]
        public string PeriodName { get; set; } = string.Empty;

        [Required]
        public DateTime StartDate { get; set; }

        [Required]
        public DateTime EndDate { get; set; }

        public bool IsClosed { get; set; }

        // Menandakan periode ini sedang di-VIEW oleh user pemiliknya (dipilih
        // lewat ikon mata di halaman Periods). Maksimum satu baris TRUE per
        // UserId — dijaga oleh unique partial index (UserId) di database.
        // Seluruh aplikasi (Dashboard, General/Adjusting Journal, laporan)
        // mengikuti periode mana yang sedang IsSelected = true milik user itu.
        public bool IsSelected { get; set; }
    }
}
