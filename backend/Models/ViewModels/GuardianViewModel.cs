namespace AumoBackend.Models.ViewModels
{
    public class UserSessionDto
    {
        public Guid Id { get; set; }
        public string DeviceName { get; set; } = string.Empty;
        public string OperatingSystem { get; set; } = string.Empty;
        public string Browser { get; set; } = string.Empty;
        public string UserAgent { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public string Country { get; set; } = "ID";
        public bool IsCurrent { get; set; }
        public DateTime LastActivityAt { get; set; }
    }

    public class LoginActivityDto
    {
        public Guid Id { get; set; }
        public string ActivityType { get; set; } = string.Empty;
        public string Device { get; set; } = string.Empty;
        public string OperatingSystem { get; set; } = string.Empty;
        public string UserAgent { get; set; } = string.Empty;
        public string Browser { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public string Country { get; set; } = "ID";
        public bool IsSuccess { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
