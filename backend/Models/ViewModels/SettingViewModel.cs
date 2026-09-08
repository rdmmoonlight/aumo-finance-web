using System.ComponentModel.DataAnnotations;

namespace AumoBackend.Models
{
    public class SettingsViewModel
    {
        [Display(Name = "Mode Gelap")]
        public bool IsDarkMode { get; set; }

        [Display(Name = "Peringatan Sistem")]
        public bool EnableSystemAlerts { get; set; } = true;
    }
}
