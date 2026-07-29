using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AumoFinance.Models.Security;

public class LoginActivity
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();


    // Relasi ke Identity User
    [Required]
    public Guid UserId { get; set; }



    // Jenis aktivitas
    // Contoh:
    // Login Success
    // Login Failed
    // Logout
    // Password Changed
    [Required]
    [MaxLength(50)]
    public string ActivityType { get; set; } = string.Empty;



    // Status aktivitas
    public bool IsSuccess { get; set; }



    // Informasi perangkat
    [MaxLength(150)]
    public string Device { get; set; } = "Unknown Device";


    [MaxLength(100)]
    public string Browser { get; set; } = "Unknown Browser";


    [MaxLength(100)]
    public string OperatingSystem { get; set; } = "Unknown OS";



    // Informasi jaringan
    [MaxLength(45)]
    public string IpAddress { get; set; } = string.Empty;


    [MaxLength(100)]
    public string Country { get; set; } = string.Empty;


    [MaxLength(500)]
    public string UserAgent { get; set; } = string.Empty;



    // Waktu kejadian
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;



    // Pesan tambahan jika diperlukan
    [MaxLength(500)]
    public string? Description { get; set; }



    [ForeignKey(nameof(UserId))]
    public virtual ApplicationUser? User { get; set; }
}
