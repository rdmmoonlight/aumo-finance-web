using System;
using System.ComponentModel.DataAnnotations;

namespace AumoFinance.Models
{
    public class Period
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string PeriodName { get; set; } = string.Empty;

        [Required]
        public DateTime StartDate { get; set; }

        [Required]
        public DateTime EndDate { get; set; }

        public bool IsClosed { get; set; }

        // Menandakan periode ini sedang di-VIEW (dipilih lewat ikon mata di
        // halaman Periods). Hanya boleh ada maksimum satu baris TRUE di
        // seluruh tabel — dijaga oleh unique partial index di database.
        // Seluruh aplikasi (Dashboard, General/Adjusting Journal, dst.)
        // mengikuti periode mana yang sedang IsSelected = true.
        public bool IsSelected { get; set; }
    }
}
