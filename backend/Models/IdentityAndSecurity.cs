using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace AumoBackend.Models;

/// <summary>
    /// The application's user record, owned entirely by ASP.NET Core Identity.
    /// Replaces the old hand-rolled User entity, which only ever shadowed
    /// accounts that actually lived in a separate external Aumo.Api service.
    /// </summary>
    public class ApplicationUser : IdentityUser<Guid>
    {
        public string? FullName { get; set; }
    }

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

public class RecoveryCode
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public ApplicationUser User { get; set; } = null!;

    public string CodeHash { get; set; } = string.Empty;

    public bool Used { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UsedAt { get; set; }
}

public class SecuritySetting
{
    public Guid UserId { get; set; }

    public ApplicationUser User { get; set; } = null!;

    public bool EmailVerified { get; set; }

    public bool TwoFactorEnabled { get; set; }

    public bool LoginNotificationEnabled { get; set; }

    public int SessionTimeoutMinutes { get; set; } = 30;

    public DateTime UpdatedAt { get; set; }
}

public class TrustedDevice
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public ApplicationUser User { get; set; } = null!;

    public string DeviceName { get; set; } = string.Empty;

    public string DeviceIdentifier { get; set; } = string.Empty;

    public string Browser { get; set; } = string.Empty;

    public string OperatingSystem { get; set; } = string.Empty;

    public bool IsTrusted { get; set; } = true;

    public DateTime CreatedAt { get; set; }

    public DateTime LastUsedAt { get; set; }
}

