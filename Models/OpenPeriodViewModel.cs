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

        // --- 1. CASH ACCOUNT ---
        [Required]
        [Display(Name = "Cash Account Ref (Code)")]
        public string CashAccountCode { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Cash Account Name")]
        public string CashAccountName { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Cash Opening Balance")]
        [Range(0, double.MaxValue, ErrorMessage = "Balance cannot be negative.")]
        public decimal CashBalance { get; set; }

        // --- 2. BANK ACCOUNT ---
        [Required]
        [Display(Name = "Bank Account Ref (Code)")]
        public string BankAccountCode { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Bank Account Name")]
        public string BankAccountName { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Bank Opening Balance")]
        [Range(0, double.MaxValue, ErrorMessage = "Balance cannot be negative.")]
        public decimal BankBalance { get; set; }

        // --- 3. RETAINED EARNINGS ACCOUNT ---
        [Required]
        [Display(Name = "Retained Earnings Ref (Code)")]
        public string RetainedEarningsAccountCode { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Retained Earnings Name")]
        public string RetainedEarningsAccountName { get; set; } = string.Empty;

        // Referensi tampilan saja (bukan diisi lewat form): daftar akun COA
        // yang sudah ada, supaya user tahu nomor ref mana saja yang sudah
        // terpakai sebelum mengisi 3 kode akun baru di atas.
        public List<ChartOfAccount> ExistingAccounts { get; set; } = new();
    }
}
