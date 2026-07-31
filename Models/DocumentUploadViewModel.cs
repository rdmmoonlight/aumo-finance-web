using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;

namespace AumoFinance.ViewModels
{
    public class DocumentUploadViewModel
    {
        [Required]
        [Display(Name = "Document Title")]
        public string Title { get; set; }

        [Required]
        public string Category { get; set; }

        [Display(Name = "Reference Number (Optional)")]
        public string ReferenceNumber { get; set; }

        public string Description { get; set; }

        [Required]
        [Display(Name = "Select File")]
        public IFormFile UploadedFile { get; set; }
    }
}
