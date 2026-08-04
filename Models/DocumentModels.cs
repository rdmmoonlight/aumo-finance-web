using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Http;

namespace AumoFinance.Models;

#region Database Entity
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
#endregion

#region View Models
public class DocumentUploadViewModel
{
    [Required]
    [Display(Name = "Document Title")]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Category { get; set; } = string.Empty;

    [Display(Name = "Reference Number (Optional)")]
    public string? ReferenceNumber { get; set; }

    [Display(Name = "Link to Journal Entry (SSOT)")]
    public int? JournalEntryId { get; set; }

    public string? Description { get; set; }

    [Required]
    [Display(Name = "Select File")]
    public IFormFile? UploadedFile { get; set; }
}

public class DocumentIndexViewModel
{
    public IEnumerable<EconomicDocument> Documents { get; set; } = new List<EconomicDocument>();

    public int TotalDocuments { get; set; }
    public double TotalStorageMB { get; set; }
    public int AddedLast7Days { get; set; }
    public string MostFrequentCategory { get; set; } = "-";

    public DateTime AppDeploymentDate { get; set; }
    public int AppAgeDays { get; set; }
    public int TotalJournalEntries { get; set; }
    public int TotalChartOfAccounts { get; set; }
    public int TotalActivePeriods { get; set; }
    public int TotalSystemUsers { get; set; }
    public double AverageFileSizeKB { get; set; }
}
#endregion
