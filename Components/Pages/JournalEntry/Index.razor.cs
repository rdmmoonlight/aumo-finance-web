using System.Globalization;
using System.Security.Claims;
using AumoFinance.Models;
using AumoFinance.Services;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.JSInterop;

// Alias untuk menghindari bentrok nama namespace JournalEntry dan class model
using JournalEntryEntity = AumoFinance.Models.JournalEntry;

namespace AumoFinance.Components.Pages.JournalEntry;

public partial class Index : ComponentBase
{
    [Inject] protected AppDbContext DbContext { get; set; } = default!;
    [Inject] protected ITransactionNumberService TxNumberService { get; set; } = default!;
    [Inject] protected NavigationManager Nav { get; set; } = default!;
    [Inject] protected IJSRuntime JS { get; set; } = default!;
    [Inject] protected AuthenticationStateProvider AuthStateProvider { get; set; } = default!;

    [Parameter] public int? EntryId { get; set; }
    public Guid UserId { get; set; }

    protected static readonly CultureInfo CultureInfo = new("id-ID");

    protected bool IsEdit => EntryId.HasValue;

    protected List<LineItem> lines = new();
    protected List<ChartOfAccount> availableAccounts = new();
    protected string journalType = "General";
    protected DateTime entryDate = DateTime.Today;
    protected string transactionNumber = string.Empty;
    protected string? successMessage;
    protected string? lockedMessage;
    protected List<string> validationErrors = new();

    protected decimal TotalDebit => lines.Sum(l => l.Debit ?? 0);
    protected decimal TotalCredit => lines.Sum(l => l.Credit ?? 0);
    protected bool IsBalanced => TotalDebit > 0 && TotalCredit > 0 && TotalDebit == TotalCredit;

    protected override async Task OnInitializedAsync()
    {
        var authState = await AuthStateProvider.GetAuthenticationStateAsync();
        var user = authState.User;

        if (user.Identity?.IsAuthenticated == true)
        {
            var claim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (Guid.TryParse(claim, out var parsedId))
            {
                UserId = parsedId;
            }
        }

        if (UserId == Guid.Empty)
        {
            Nav.NavigateTo("/auth/login", true);
            return;
        }

        availableAccounts = await ActiveAccountsAsync();

        if (IsEdit)
        {
            var entry = await DbContext.JournalEntries
                .Include(j => j.Lines)
                .FirstOrDefaultAsync(j => j.Id == EntryId!.Value && j.UserId == UserId);

            if (entry == null)
            {
                lockedMessage = "Journal entry not found.";
                return;
            }

            var closedPeriods = await DbContext.Periods.Where(p => p.UserId == UserId && p.IsClosed).ToListAsync();
            if (PeriodLock.IsDateLocked(entry.EntryDate, closedPeriods))
            {
                lockedMessage = $"Journal entry {TransactionNumberFormatter.ToDisplay(entry.TransactionNumber)} belongs to a closed period and cannot be edited. View it from the Periods page instead.";
                return;
            }

            transactionNumber = TransactionNumberFormatter.ToDisplay(entry.TransactionNumber);
            journalType = entry.JournalType;
            entryDate = entry.EntryDate;
            lines = entry.Lines
                .OrderBy(l => l.LineOrder)
                .Select(l => new LineItem
                {
                    AccountId = l.AccountId,
                    LineDescription = l.LineDescription,
                    Debit = l.Debit == 0 ? null : l.Debit,
                    Credit = l.Credit == 0 ? null : l.Credit
                }).ToList();
        }
        else
        {
            await ResetFormAsync();
        }
    }

    protected async Task ResetFormAsync()
    {
        journalType = "General";
        entryDate = DateTime.Today;
        lines = new List<LineItem> { new LineItem(), new LineItem() };
        validationErrors.Clear();
        await RefreshTransactionNumberPreviewAsync();
    }

    protected async Task OnJournalTypeChanged(ChangeEventArgs e)
    {
        journalType = e.Value?.ToString() ?? "General";
        await RefreshTransactionNumberPreviewAsync();
    }

    protected async Task OnEntryDateChanged(ChangeEventArgs e)
    {
        entryDate = DateTime.TryParse((string?)e.Value, out var dt) ? dt : DateTime.Today;
        await RefreshTransactionNumberPreviewAsync();
    }

    // Nomor transaksi pada mode Create adalah perkiraan (preview) dan
    // baru benar-benar dikonsumsi/dikunci saat entry disimpan lewat
    // TxNumberService.GenerateAsync di HandleSubmit. Tidak berlaku untuk
    // mode Edit karena nomornya sudah final sejak entry dibuat.
    protected async Task RefreshTransactionNumberPreviewAsync()
    {
        if (IsEdit || UserId == Guid.Empty) return;
        transactionNumber = TransactionNumberFormatter.ToDisplay(
            await TxNumberService.PeekNextAsync(UserId, journalType, entryDate));
    }

    protected void AddLine() => lines.Add(new LineItem());

    protected async Task RemoveLine(LineItem line)
    {
        if (lines.Count <= 2)
        {
            await JS.InvokeVoidAsync("alert", "A journal entry must have at least two line items (Debit & Credit).");
            return;
        }
        lines.Remove(line);
    }

    protected void OnDescriptionInput(LineItem line, string? value)
    {
        line.LineDescription = value;
        line.SearchVersion++;
        var myVersion = line.SearchVersion;

        var query = value?.Trim() ?? "";
        if (query.Length < 2)
        {
            line.ShowSuggestions = false;
            line.Suggestions.Clear();
            return;
        }

        _ = DebouncedSearchAsync(line, query, myVersion);
    }

    protected async Task DebouncedSearchAsync(LineItem line, string query, int myVersion)
    {
        await Task.Delay(250);
        if (line.SearchVersion != myVersion) return;

        var results = await SearchDescriptionsAsync(query);
        if (line.SearchVersion != myVersion) return;

        line.Suggestions = results;
        line.ShowSuggestions = results.Any();
        StateHasChanged();
    }

    protected void SelectSuggestion(LineItem line, string text)
    {
        line.LineDescription = text;
        line.ShowSuggestions = false;
    }

    // Debit/Credit ditampilkan sebagai teks berformat ribuan (mis. 100.000)
    // alih-alih <input type="number">, karena input number memperlakukan
    // "." sebagai desimal sehingga "100.000" terbaca 100. Nilai asli tetap
    // disimpan sebagai decimal; parsing hanya mengambil digitnya.
    protected void OnDebitInput(LineItem line, string? value)
    {
        line.Debit = ParseAmount(value);
    }

    protected void OnCreditInput(LineItem line, string? value)
    {
        line.Credit = ParseAmount(value);
    }

    protected static decimal? ParseAmount(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var digitsOnly = new string(value.Where(char.IsDigit).ToArray());
        if (digitsOnly.Length == 0) return null;
        return decimal.Parse(digitsOnly, CultureInfo.InvariantCulture);
    }

    protected static string FormatAmount(decimal? value)
    {
        return value.HasValue && value.Value != 0
            ? value.Value.ToString("N0", CultureInfo)
            : string.Empty;
    }

    protected async Task<List<string>> SearchDescriptionsAsync(string q)
    {
        var keyword = q.Trim();
        return await DbContext.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry!.UserId == UserId
                     && l.LineDescription != null && l.LineDescription != ""
                     && EF.Functions.ILike(l.LineDescription, $"%{keyword}%"))
            .GroupBy(l => l.LineDescription)
            .OrderByDescending(g => g.Count())
            .ThenByDescending(g => g.Max(l => l.Id))
            .Select(g => g.Key!)
            .Take(8)
            .ToListAsync();
    }

    protected async Task HandleSubmit()
    {
        validationErrors.Clear();
        successMessage = null;

        var effectiveLines = lines
            .Where(l => l.AccountId != 0 && ((l.Debit ?? 0) != 0 || (l.Credit ?? 0) != 0))
            .ToList();

        if (effectiveLines.Count < 2)
        {
            validationErrors.Add("A journal entry must have at least two line items.");
        }

        var totalDebit = effectiveLines.Sum(l => l.Debit ?? 0);
        var totalCredit = effectiveLines.Sum(l => l.Credit ?? 0);
        if (totalDebit != totalCredit || totalDebit == 0)
        {
            validationErrors.Add("Total debit must equal total credit before posting.");
        }

        var validAccountIds = (await DbContext.ChartOfAccounts
            .Where(a => a.IsActive && a.UserId == UserId).Select(a => a.Id).ToListAsync()).ToHashSet();
        if (effectiveLines.Any(l => !validAccountIds.Contains(l.AccountId)))
        {
            validationErrors.Add("One or more selected accounts are invalid or inactive.");
        }

        var closedPeriods = await DbContext.Periods.Where(p => p.UserId == UserId && p.IsClosed).ToListAsync();

        if (IsEdit)
        {
            var entry = await DbContext.JournalEntries
                .Include(j => j.Lines)
                .FirstOrDefaultAsync(j => j.Id == EntryId!.Value && j.UserId == UserId);

            if (entry == null)
            {
                lockedMessage = "Journal entry not found.";
                return;
            }

            if (PeriodLock.IsDateLocked(entry.EntryDate, closedPeriods) || PeriodLock.IsDateLocked(entryDate, closedPeriods))
            {
                lockedMessage = $"Journal entry {TransactionNumberFormatter.ToDisplay(entry.TransactionNumber)} falls within a closed period and cannot be modified.";
                return;
            }

            if (validationErrors.Any()) return;

            entry.JournalType = journalType;
            entry.EntryDate = DateTime.SpecifyKind(entryDate, DateTimeKind.Utc);
            entry.UpdatedAt = await GetDeviceLocalTimestampAsync();

            DbContext.JournalEntryLines.RemoveRange(entry.Lines);
            entry.Lines = effectiveLines.Select((l, index) => new JournalEntryLine
            {
                JournalEntryId = entry.Id,
                AccountId = l.AccountId,
                LineDescription = l.LineDescription,
                Debit = l.Debit ?? 0,
                Credit = l.Credit ?? 0,
                LineOrder = index
            }).ToList();

            await DbContext.SaveChangesAsync();
            Nav.NavigateTo("/reports/general-journal");
        }
        else
        {
            if (PeriodLock.IsDateLocked(entryDate, closedPeriods))
            {
                validationErrors.Add("This date falls within a closed period. Choose a date in an open period.");
            }

            if (validationErrors.Any()) return;

            var deviceLocalNow = await GetDeviceLocalTimestampAsync();

            var entry = new JournalEntryEntity
            {
                UserId = UserId,
                TransactionNumber = await TxNumberService.GenerateAsync(UserId, journalType, entryDate),
                JournalType = journalType,
                EntryDate = DateTime.SpecifyKind(entryDate, DateTimeKind.Utc),
                CreatedAt = deviceLocalNow,
                Lines = effectiveLines.Select((l, index) => new JournalEntryLine
                {
                    AccountId = l.AccountId,
                    LineDescription = l.LineDescription,
                    Debit = l.Debit ?? 0,
                    Credit = l.Credit ?? 0,
                    LineOrder = index
                }).ToList()
            };

            DbContext.JournalEntries.Add(entry);
            await DbContext.SaveChangesAsync();

            successMessage = $"Journal entry {TransactionNumberFormatter.ToDisplay(entry.TransactionNumber)} has been posted.";
            await ResetFormAsync();
        }
    }

    protected async Task<DateTime> GetDeviceLocalTimestampAsync()
    {
        try
        {
            var localTimestamp = await JS.InvokeAsync<string>("aumoTime.getLocalTimestamp");
            if (DateTime.TryParse(localTimestamp, out var localNow))
            {
                return DateTime.SpecifyKind(localNow, DateTimeKind.Utc);
            }
        }
        catch
        {
            // Fallback
        }

        return DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
    }

    protected async Task<List<ChartOfAccount>> ActiveAccountsAsync()
    {
        return await DbContext.ChartOfAccounts
            .Where(a => a.IsActive && a.UserId == UserId)
            .OrderBy(a => a.ReferenceNumber)
            .ToListAsync();
    }

    public class LineItem
    {
        public int AccountId { get; set; }
        public string? LineDescription { get; set; }
        public decimal? Debit { get; set; }
        public decimal? Credit { get; set; }

        public List<string> Suggestions { get; set; } = new();
        public bool ShowSuggestions { get; set; }
        public int SearchVersion { get; set; }
    }
}
