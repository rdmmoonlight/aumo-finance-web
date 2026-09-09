using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AumoBackend.Models.Guardian
{
    [Table("UserSessions")]
    public class UserSession
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid UserId { get; set; }

        [Required]
        public string DeviceName { get; set; } = string.Empty;

        [Required]
        public string OperatingSystem { get; set; } = string.Empty;

        [Required]
        public string Browser { get; set; } = string.Empty;

        [Required]
        public string UserAgent { get; set; } = string.Empty;

        [Required]
        public string IpAddress { get; set; } = string.Empty;

        [Required]
        public string Country { get; set; } = "ID";

        [Required]
        public string RefreshTokenHash { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public bool IsCurrent { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;

        public DateTime? RevokedAt { get; set; }
    }

    [Table("LoginActivities")]
    public class LoginActivity
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid UserId { get; set; }

        [Required]
        public string ActivityType { get; set; } = string.Empty;

        [Required]
        public string Device { get; set; } = string.Empty;

        [Required]
        public string OperatingSystem { get; set; } = string.Empty;

        [Required]
        public string UserAgent { get; set; } = string.Empty;

        [Required]
        public string Browser { get; set; } = string.Empty;

        [Required]
        public string IpAddress { get; set; } = string.Empty;

        [Required]
        public string Country { get; set; } = "ID";

        public bool IsSuccess { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
