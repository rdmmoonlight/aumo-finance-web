using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AumoFinance.Models.Security;

public class UserSession
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();


    // Relasi ke Identity User
    [Required]
    public Guid UserId { get; set; }


    // Informasi perangkat
    [MaxLength(150)]
    public string DeviceName { get; set; } = "Unknown Device";


    [MaxLength(100)]
    public string Browser { get; set; } = "Unknown Browser";


    [MaxLength(100)]
    public string OperatingSystem { get; set; } = "Unknown OS";


    // Network information
    [MaxLength(45)]
    public string IpAddress { get; set; } = string.Empty;


    [MaxLength(500)]
    public string UserAgent { get; set; } = string.Empty;



    // Status session
    public bool IsActive { get; set; } = true;


    // Menandai device yang sedang dipakai
    public bool IsCurrent { get; set; }


    // Waktu dibuat
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;


    // Aktivitas terakhir
    public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;


    // Waktu logout/revoke
    public DateTime? RevokedAt { get; set; }



    // Optional navigation ke Identity User
    [ForeignKey(nameof(UserId))]
    public virtual ApplicationUser? User { get; set; }
}
