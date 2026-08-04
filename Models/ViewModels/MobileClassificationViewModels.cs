namespace AumoFinance.Models;

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
