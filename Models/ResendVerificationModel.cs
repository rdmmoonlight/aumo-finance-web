using System.ComponentModel.DataAnnotations;

namespace AumoFinance.Models;

public class ResendVerificationModel
{
    [Required(ErrorMessage = "Email wajib diisi.")]
    [EmailAddress(ErrorMessage = "Format email tidak valid.")]
    public string Email { get; set; } = string.Empty;
}
