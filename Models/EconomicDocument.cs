using System;
using System.ComponentModel.DataAnnotations;

namespace AumoFinance.Models
{
    public class EconomicDocument
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Document Title")]
        public string Title { get; set; }

        [Required]
        [StringLength(50)]
        public string Category { get; set; } // e.g., Invoice, Receipt, Tax Return, Contract

        [Display(Name = "Reference Number")]
        [StringLength(100)]
        public string ReferenceNumber { get; set; } // For Journal/GL linking

        [Required]
        [StringLength(255)]
        public string FileName { get; set; }

        [Required]
        [StringLength(500)]
        public string FilePath { get; set; }

        public long FileSize { get; set; } // In bytes

        [StringLength(100)]
        public string ContentType { get; set; }

        [Required]
        public string UploadedBy { get; set; }

        [Required]
        public DateTime UploadDate { get; set; } = DateTime.UtcNow;

        public string Description { get; set; }
    }
}
