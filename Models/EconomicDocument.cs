using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AumoFinance.Models;

public class EconomicDocument
{
    [Key]
    public int Id { get; set; }

    public Guid UserId { get; set; }

    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required, StringLength(50)]
    public string Category { get; set; } = string.Empty;

    [StringLength(100)]
    public string? ReferenceNumber { get; set; }

    [Display(Name = "Linked Journal Entry")]
    public int? JournalEntryId { get; set; }

    [ForeignKey(nameof(JournalEntryId))]
    public JournalEntry? JournalEntry { get; set; }

    [Required, StringLength(255)]
    public string FileName { get; set; } = string.Empty;

    [Required, StringLength(500)]
    public string FilePath { get; set; } = string.Empty;

    [StringLength(150)]
    public string? CloudPublicId { get; set; }

    public long FileSize { get; set; }

    [StringLength(100)]
    public string? ContentType { get; set; }

    [Required]
    public string UploadedBy { get; set; } = "System";

    [Required]
    public DateTime UploadDate { get; set; } = DateTime.UtcNow;

    public string? Description { get; set; }
}
