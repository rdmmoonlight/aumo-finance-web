using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System;

namespace AumoBackend.Models;

public class CashFlowLine
    {
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    // Laporan Arus Kas metode langsung (IAS 7). Setiap mutasi akun berperan
    // CashAndEquivalents diklasifikasikan berdasarkan tipe akun lawan pada
    // baris jurnal yang sama: Operasi (akun nominal & liabilitas jangka
    // pendek), Investasi (akun Assets non-kas), Pendanaan (Liabilities
    // jangka panjang/Equity, mis. modal atau dividen).
    public class CashFlowStatementViewModel
    {
        public decimal BeginningCash { get; set; }
        public List<CashFlowLine> OperatingActivities { get; set; } = new();
        public List<CashFlowLine> InvestingActivities { get; set; } = new();
        public List<CashFlowLine> FinancingActivities { get; set; } = new();

        public decimal NetOperating => OperatingActivities.Sum(l => l.Amount);
        public decimal NetInvesting => InvestingActivities.Sum(l => l.Amount);
        public decimal NetFinancing => FinancingActivities.Sum(l => l.Amount);
        public decimal NetChangeInCash => NetOperating + NetInvesting + NetFinancing;
        public decimal EndingCash => BeginningCash + NetChangeInCash;
    }

public class ClosingJournalLine
    {
        public int ReferenceNumber { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
    }

    public class ClosingJournalEntryGroup
    {
        public string Description { get; set; } = string.Empty;
        public List<ClosingJournalLine> Lines { get; set; } = new();
        public decimal TotalDebit => Lines.Sum(l => l.Debit);
        public decimal TotalCredit => Lines.Sum(l => l.Credit);
    }

    // Jurnal penutup dihitung langsung dari saldo akun nominal (tidak
    // disimpan ke database) — metode langsung ke Retained Earnings, tanpa
    // akun perantara Income Summary, karena COA tidak menyediakan peran
    // tersebut.
    public class ClosingJournalViewModel
    {
        public List<ClosingJournalEntryGroup> Groups { get; set; } = new();
        public decimal NetIncome { get; set; }
        public string RetainedEarningsAccountName { get; set; } = "Retained Earnings";
    }

public class DashboardViewModel
    {
        // PERBAIKAN: Ditambahkan untuk menangani @Model.UserId di Views/Dashboard/Index.cshtml
        public Guid UserId { get; set; }

        public decimal TotalCashAndEquivalents { get; set; }
        public decimal RevenueThisPeriod { get; set; }
        public decimal OperatingExpenses { get; set; }
        public decimal NetIncome { get; set; }
        public decimal TotalAssets { get; set; }
        public decimal TotalLiabilities { get; set; }

        // Trend percentages
        public decimal? CashTrendPercent { get; set; }
        public decimal? RevenueTrendPercent { get; set; }
        public decimal? ExpenseTrendPercent { get; set; }
        public decimal? NetIncomeTrendPercent { get; set; }

        // Predictive & Financial Health Metrics
        public decimal MonthlyBurnRate { get; set; }
        public double CashRunwayMonths { get; set; }
        public int FinancialHealthScore { get; set; }

        public List<string> ChartLabels { get; set; } = new();
        public List<decimal> ChartRevenue { get; set; } = new();
        public List<decimal> ChartExpenses { get; set; } = new();

        public List<string> ExpenseCategoryLabels { get; set; } = new();
        public List<decimal> ExpenseCategoryValues { get; set; } = new();

        // Safe null-check & penyederhanaan LINQ
        public bool HasExpenseData => ExpenseCategoryValues?.Any(v => v > 0) ?? false;

        public List<JournalEntryDto> RecentJournals { get; set; } = new();
        public List<CoaBalanceDto> MainCoaBalances { get; set; } = new();

        public string ActivePeriodName { get; set; } = "No Active Period";
        public DateTime? ActivePeriodStart { get; set; }
        public DateTime? ActivePeriodEnd { get; set; }

        public bool HasSelectedPeriod { get; set; }
        public bool IsSelectedPeriodClosed { get; set; }
    }

    public class JournalEntryDto
    {
        public DateTime Date { get; set; }
        public decimal TotalDebit { get; set; }
        public decimal TotalCredit { get; set; }
    }

    public class CoaBalanceDto
    {
        public string AccountCode { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public decimal Balance { get; set; }
    }

public class ErrorModel
{
    public string? RequestId { get; set; }

    public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);
}

public class ForgotPasswordModel
    {
        [Required(ErrorMessage = "Email address is required")]
        [EmailAddress(ErrorMessage = "Invalid email address format")]
        public string Email { get; set; } = string.Empty;
    }

// Satu kartu ledger per akun. Baris-barisnya diambil langsung dari
    // JournalEntryLine (yang diinput lewat Journal Entry), sehingga General
    // Ledger tidak pernah "lepas" dari General Journal.
    public class LedgerAccountViewModel
    {
        public int AccountId { get; set; }
        public int ReferenceNumber { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public bool NormalBalanceIsDebit { get; set; }
        public List<LedgerLineViewModel> Lines { get; set; } = new();
        public decimal EndingBalance { get; set; }
    }

    public class LedgerLineViewModel
    {
        public DateTime EntryDate { get; set; }
        public string? Description { get; set; }
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        public decimal RunningBalance { get; set; }
    }

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

    public class GuardianDashboardViewModel
    {
        public SecurityStatusViewModel SecurityStatus { get; set; } = new();
        public List<LoginActivityViewModel> RecentActivities { get; set; } = new();
        public List<ActiveSessionViewModel> ActiveSessions { get; set; } = new();
    }

    public class SecurityStatusViewModel
    {
        public string StatusLevel { get; set; } = "Good";
        public int ActiveSessionsCount { get; set; }
        public int FailedAttemptsLast24Hours { get; set; }
        public DateTime? LastSuccessfulLogin { get; set; }
    }

    public class LoginActivityViewModel
    {
        public Guid Id { get; set; }
        public string ActivityType { get; set; } = string.Empty;
        public string Device { get; set; } = string.Empty;
        public string OperatingSystem { get; set; } = string.Empty;
        public string Browser { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public string Country { get; set; } = "ID";
        public bool IsSuccess { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class ActiveSessionViewModel
    {
        public Guid Id { get; set; }
        public string DeviceName { get; set; } = string.Empty;
        public string OperatingSystem { get; set; } = string.Empty;
        public string Browser { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public string Country { get; set; } = "ID";
        public bool IsCurrent { get; set; }
        public DateTime LastActivityAt { get; set; }
    }

public class IncomeStatementLine
    {
        public int ReferenceNumber { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    // Format IAS 1 (Statement of Profit or Loss) untuk laporan keuangan
    // pribadi: Pendapatan dikurangi Beban Usaha menjadi Laba Usaha, lalu
    // ditambah/kurang Pendapatan & Beban Lain-lain menjadi Laba Bersih.
    // Tidak ada Beban Pokok Penjualan (COGS) / Laba Bruto karena tidak
    // relevan untuk entitas non-dagang.
    public class IncomeStatementViewModel
    {
        public DateTime AsOfDate { get; set; }

        public List<IncomeStatementLine> Revenues { get; set; } = new();
        public List<IncomeStatementLine> OperatingExpenses { get; set; } = new();
        public List<IncomeStatementLine> OtherIncome { get; set; } = new();
        public List<IncomeStatementLine> OtherExpenses { get; set; } = new();

        public decimal TotalRevenue => Revenues.Sum(l => l.Amount);
        public decimal TotalOperatingExpenses => OperatingExpenses.Sum(l => l.Amount);
        public decimal OperatingIncome => TotalRevenue - TotalOperatingExpenses;

        public decimal TotalOtherIncome => OtherIncome.Sum(l => l.Amount);
        public decimal TotalOtherExpenses => OtherExpenses.Sum(l => l.Amount);

        public decimal NetIncome => OperatingIncome + TotalOtherIncome - TotalOtherExpenses;
    }

public class JournalEntryCreateViewModel
    {
        [Required]
        public string JournalType { get; set; } = "General";

        [Required]
        [DataType(DataType.Date)]
        public DateTime EntryDate { get; set; } = DateTime.Today;

        public List<JournalEntryLineInputModel> Lines { get; set; } = new()
        {
            new JournalEntryLineInputModel(),
            new JournalEntryLineInputModel()
        };

        // Daftar akun aktif dari Chart of Account, dipakai untuk mengisi
        // dropdown "Account" di setiap baris jurnal. Setiap opsi menampilkan
        // Nomor Ref. COA secara otomatis (mis. "101 - Cash on Hand").
        public List<ChartOfAccount> AvailableAccounts { get; set; } = new();
    }

    public class JournalEntryLineInputModel
    {
        public int AccountId { get; set; }

        [StringLength(250)]
        public string? LineDescription { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? Debit { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? Credit { get; set; }
    }

    // Dipakai oleh JournalEntry/Edit. Mewarisi field yang sama dengan Create,
    // ditambah Id (entry yang diedit) dan TransactionNumber (ditampilkan
    // read-only, tidak diregenerasi ulang saat entry diedit).
    public class JournalEntryEditViewModel
    {
        public int Id { get; set; }

        public string TransactionNumber { get; set; } = string.Empty;

        [Required]
        public string JournalType { get; set; } = "General";

        [Required]
        [DataType(DataType.Date)]
        public DateTime EntryDate { get; set; } = DateTime.Today;

        public List<JournalEntryLineInputModel> Lines { get; set; } = new()
        {
            new JournalEntryLineInputModel(),
            new JournalEntryLineInputModel()
        };

        public List<ChartOfAccount> AvailableAccounts { get; set; } = new();
    }

public class LoginViewModel
    {
        [Required(ErrorMessage = "Email address is required")]
        [EmailAddress(ErrorMessage = "Invalid email address format")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required")]
        public string Password { get; set; } = string.Empty;
    }

// Baris daftar di halaman index verifikasi (gabungan Simple + Manual).
public class MobilePendingListItemViewModel
{
    public int Id { get; set; }
    public DateTime EntryDate { get; set; }
    public string Mode { get; set; } = string.Empty; // "Simple" | "Manual"
    public string? Type { get; set; }
    public decimal Amount { get; set; }
    public string? Note { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime SubmittedAt { get; set; }
    public int LineCount { get; set; }
}

// Untuk mode "Simple": staf memilih akun lawan (income/expense) + akun kas.
public class MobileClassifySimpleViewModel
{
    public int MobileJournalEntryId { get; set; }
    public DateTime EntryDate { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Note { get; set; }

    public int CashAccountId { get; set; }
    public int ClassifiedAccountId { get; set; }

    public List<ChartOfAccount> CashAccounts { get; set; } = new();
    public List<ChartOfAccount> IncomeOrExpenseAccounts { get; set; } = new();
}

// Untuk mode "Manual": akun tiap baris sudah dipilih dari app, staf tinggal
// meninjau lalu approve/reject (opsional edit sebelum approve).
public class MobileClassifyManualLineViewModel
{
    public int AccountId { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string? LineDescription { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}

public class MobileClassifyManualViewModel
{
    public int MobileJournalEntryId { get; set; }
    public DateTime EntryDate { get; set; }
    public string? Note { get; set; }
    public List<MobileClassifyManualLineViewModel> Lines { get; set; } = new();
    public decimal TotalDebit => Lines.Sum(l => l.Debit);
    public decimal TotalCredit => Lines.Sum(l => l.Credit);
}

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

        // Referensi tampilan khusus akun permanen (bukan diisi lewat form):
        public List<ChartOfAccount> PermanentAccounts { get; set; } = new();
        public List<ChartOfAccount> AvailableCashAndBankAccounts { get; set; } = new();
        public List<ChartOfAccount> AvailableRetainedEarningsAccounts { get; set; } = new();
        public bool HasExistingPermanentAccounts { get; set; }
    }

public class RegisterViewModel
    {
        [Required(ErrorMessage = "Email address is required")]
        [EmailAddress(ErrorMessage = "Invalid email address format")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required")]
        [MinLength(6, ErrorMessage = "Password must be at least 6 characters")]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "Full Name is required")]
        public string FullName { get; set; } = string.Empty;
    }

public class ResendVerificationModel
{
    [Required(ErrorMessage = "Email wajib diisi.")]
    [EmailAddress(ErrorMessage = "Format email tidak valid.")]
    public string Email { get; set; } = string.Empty;
}

public class ResetPasswordModel
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Token { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required")]
        [MinLength(6, ErrorMessage = "Password must be at least 6 characters")]
        public string NewPassword { get; set; } = string.Empty;

        [Required(ErrorMessage = "Please confirm your password")]
        [Compare(nameof(NewPassword), ErrorMessage = "Passwords do not match")]
        public string ConfirmPassword { get; set; } = string.Empty;
    }

// Retained Earnings Statement: bridges the Income Statement with the
    // Equity section on the Balance Sheet (US GAAP / ASC 210).
    public class RetainedEarningsViewModel
    {
        public string AccountName { get; set; } = "Retained Earnings";
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal BeginningBalance { get; set; }
        public decimal NetIncome { get; set; }
        public decimal Dividends { get; set; }
        public decimal EndingBalance => BeginningBalance + NetIncome - Dividends;
    }

public class SettingsViewModel
    {
        [Display(Name = "Mode Gelap")]
        public bool IsDarkMode { get; set; }

        [Display(Name = "Peringatan Sistem")]
        public bool EnableSystemAlerts { get; set; } = true;
    }

public class FinancialPositionLine
    {
        public int ReferenceNumber { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    // Format IAS 1 (Statement of Financial Position). Saldo Laba yang
    // ditampilkan adalah saldo akhir dari Retained Earnings Statement
    // (saldo awal + laba/rugi periode berjalan), bukan saldo mentah akun
    // Retained Earnings di ledger — karena penutupan buku belum diposting.
    public class StatementOfFinancialPositionViewModel
    {
        public DateTime AsOfDate { get; set; }
        public bool IsPostClosing { get; set; }

        public List<FinancialPositionLine> Assets { get; set; } = new();
        public List<FinancialPositionLine> Liabilities { get; set; } = new();
        public List<FinancialPositionLine> EquityExcludingRetainedEarnings { get; set; } = new();
        public decimal RetainedEarningsEnding { get; set; }

        public decimal TotalAssets => Assets.Sum(l => l.Amount);
        public decimal TotalLiabilities => Liabilities.Sum(l => l.Amount);
        public decimal TotalEquity => EquityExcludingRetainedEarnings.Sum(l => l.Amount) + RetainedEarningsEnding;
        public decimal TotalLiabilitiesAndEquity => TotalLiabilities + TotalEquity;
        public bool IsBalanced => Math.Round(TotalAssets - TotalLiabilitiesAndEquity, 2) == 0;
    }

// Satu baris Neraca Saldo per akun. Dipakai bersama oleh Trial Balance
    // (hanya JournalType "General") dan Adjusted Trial Balance (General +
    // Adjusting), supaya logika penyajian tetap konsisten.
    public class TrialBalanceRow
    {
        public int AccountId { get; set; }
        public int ReferenceNumber { get; set; } = 0;
        public string AccountName { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool NormalBalanceIsDebit { get; set; }

        // Saldo bersih akun (mengikuti sisi normal). Bisa negatif bila
        // saldo akun berlawanan dari sisi normalnya.
        public decimal NetBalance { get; set; }

        // Nilai yang tampil di kolom Debit/Kredit Neraca Saldo. Bila saldo
        // berlawanan arah dari sisi normalnya, otomatis dipindah ke sisi
        // yang sesuai supaya total Debit = total Kredit tetap terjaga.
        public decimal Debit => NetBalance >= 0
            ? (NormalBalanceIsDebit ? NetBalance : 0)
            : (NormalBalanceIsDebit ? 0 : -NetBalance);

        public decimal Credit => NetBalance >= 0
            ? (NormalBalanceIsDebit ? 0 : NetBalance)
            : (NormalBalanceIsDebit ? -NetBalance : 0);
    }

    public class TrialBalanceViewModel
    {
        public string Title { get; set; } = string.Empty;
        public List<TrialBalanceRow> Rows { get; set; } = new();
        public decimal TotalDebit => Rows.Sum(r => r.Debit);
        public decimal TotalCredit => Rows.Sum(r => r.Credit);
        public bool IsBalanced => Math.Round(TotalDebit - TotalCredit, 2) == 0;
    }

// Worksheet akuntansi 10 kolom: Neraca Saldo (belum disesuaikan),
    // Penyesuaian, Neraca Saldo Disesuaikan, Laporan Laba Rugi, dan
    // Laporan Posisi Keuangan. Setiap baris mewakili satu akun aktif.
    public class WorksheetRow
    {
        public int AccountId { get; set; }
        public int ReferenceNumber { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public bool NormalBalanceIsDebit { get; set; }

        public decimal UnadjustedDebit { get; set; }
        public decimal UnadjustedCredit { get; set; }

        public decimal AdjustmentDebit { get; set; }
        public decimal AdjustmentCredit { get; set; }

        public decimal AdjustedDebit { get; set; }
        public decimal AdjustedCredit { get; set; }

        public decimal IncomeStatementDebit { get; set; }
        public decimal IncomeStatementCredit { get; set; }

        public decimal FinancialPositionDebit { get; set; }
        public decimal FinancialPositionCredit { get; set; }
    }

    public class WorksheetViewModel
    {
        public List<WorksheetRow> Rows { get; set; } = new();
        public decimal NetIncome { get; set; }

        public decimal TotalUnadjustedDebit => Rows.Sum(r => r.UnadjustedDebit);
        public decimal TotalUnadjustedCredit => Rows.Sum(r => r.UnadjustedCredit);

        public decimal TotalAdjustmentDebit => Rows.Sum(r => r.AdjustmentDebit);
        public decimal TotalAdjustmentCredit => Rows.Sum(r => r.AdjustmentCredit);

        public decimal TotalAdjustedDebit => Rows.Sum(r => r.AdjustedDebit);
        public decimal TotalAdjustedCredit => Rows.Sum(r => r.AdjustedCredit);

        public decimal TotalIncomeStatementDebit => Rows.Sum(r => r.IncomeStatementDebit);
        public decimal TotalIncomeStatementCredit => Rows.Sum(r => r.IncomeStatementCredit);

        public decimal TotalFinancialPositionDebit => Rows.Sum(r => r.FinancialPositionDebit);
        public decimal TotalFinancialPositionCredit => Rows.Sum(r => r.FinancialPositionCredit);
    }
