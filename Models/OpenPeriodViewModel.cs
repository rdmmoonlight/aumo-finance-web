using System.ComponentModel.DataAnnotations;

namespace AumoFinance.Models
{
    public class OpenPeriodViewModel
    {
        [Required]
        [Display(Name = "Month")]
        public int Month { get; set; }

        [Required]
        [Display(Name = "Year")]
        public int Year { get; set; }

        [Required]
        [Display(Name = "Cash Account")]
        public int CashAccountId { get; set; }

        [Required]
        [Display(Name = "Cash Opening Balance")]
        [Range(0, double.MaxValue, ErrorMessage = "Balance cannot be negative.")]
        public decimal CashBalance { get; set; }

        [Required]
        [Display(Name = "Bank Account")]
        public int BankAccountId { get; set; }

        [Required]
        [Display(Name = "Bank Opening Balance")]
        [Range(0, double.MaxValue, ErrorMessage = "Balance cannot be negative.")]
        public decimal BankBalance { get; set; }

        [Required]
        [Display(Name = "Retained Earnings Account")]
        public int RetainedEarningsAccountId { get; set; }

    }
}
