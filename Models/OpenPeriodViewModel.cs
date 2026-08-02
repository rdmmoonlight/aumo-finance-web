using System.ComponentModel.DataAnnotations;

namespace AumoFinance.Models
{
    public class OpenPeriodViewModel
    {
        public const string ModeLoadExisting = "LoadExisting";
        public const string ModeCreateNew = "CreateNew";

        [Required]
        [Display(Name = "Month")]
        public int Month { get; set; }

        [Required]
        [Display(Name = "Year")]
        public int Year { get; set; }

        // Menentukan cara akun permanen (Cash, Bank, Retained Earnings)
        // disiapkan untuk periode ini:
        // - "LoadExisting": pakai akun permanen yang sudah ada dari periode
        //   sebelumnya (saldo otomatis lanjut karena ledger tidak di-reset
        //   per periode).
        // - "CreateNew": daftarkan akun permanen baru ke COA (khusus untuk
        //   periode pertama / instalasi baru yang belum punya akun permanen).
        [Required]
        public string SetupMode { get; set; } = ModeLoadExisting;

        // --- MODE: LOAD EXISTING ---
        [Display(Name = "Cash Account")]
        public int? CashAccountId { get; set; }

        [Display(Name = "Bank Account")]
        public int? BankAccountId { get; set; }

        [Display(Name = "Retained Earnings Account")]
        public int? RetainedEarningsAccountId { get; set; }

        // --- MODE: CREATE NEW ---
        [Display(Name = "Cash Account Ref (Code)")]
        public string? CashAccountCode { get; set; }

        [Display(Name = "Cash Account Name")]
        public string? CashAccountName { get; set; }

        [Display(Name = "Cash Opening Balance")]
        [Range(0, double.MaxValue, ErrorMessage = "Balance cannot be negative.")]
        public decimal? CashBalance { get; set; }

        [Display(Name = "Bank Account Ref (Code)")]
        public string? BankAccountCode { get; set; }

        [Display(Name = "Bank Account Name")]
        public string? BankAccountName { get; set; }

        [Display(Name = "Bank Opening Balance")]
        [Range(0, double.MaxValue, ErrorMessage = "Balance cannot be negative.")]
        public decimal? BankBalance { get; set; }

        [Display(Name = "Retained Earnings Ref (Code)")]
        public string? RetainedEarningsAccountCode { get; set; }

        [Display(Name = "Retained Earnings Name")]
        public string? RetainedEarningsAccountName { get; set; }

        // Referensi tampilan saja (bukan diisi lewat form):
        public List<ChartOfAccount> ExistingAccounts { get; set; } = new();
        public List<ChartOfAccount> AvailableCashAndBankAccounts { get; set; } = new();
        public List<ChartOfAccount> AvailableRetainedEarningsAccounts { get; set; } = new();
        public bool HasExistingPermanentAccounts { get; set; }
    }
}
