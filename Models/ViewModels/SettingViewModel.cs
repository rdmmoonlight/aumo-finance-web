using System.ComponentModel.DataAnnotations;

namespace AumoFinance.Models
{
    public class SettingsViewModel
    {
        [Display(Name = "Mode Gelap")]
        public bool IsDarkMode { get; set; }

        [Display(Name = "Peringatan Sistem")]
        public bool EnableSystemAlerts { get; set; } = true;
    }
}
