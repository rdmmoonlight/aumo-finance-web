using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;

namespace AumoFinance.ViewModels;

public class DocumentUploadViewModel
{
    [Required]
    [Display(Name = "Document Title")]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Category { get; set; } = string.Empty;

    [Display(Name = "Reference Number (Optional)")]
    public string? ReferenceNumber { get; set; }

    // --- PILIHAN LINK JOURNAL ---
    [Display(Name = "Link to Journal Entry (SSOT)")]
    public int? JournalEntryId { get; set; }
    // ----------------------------

    public string? Description { get; set; }

    [Required]
    [Display(Name = "Select File")]
    public IFormFile? UploadedFile { get; set; }
}
