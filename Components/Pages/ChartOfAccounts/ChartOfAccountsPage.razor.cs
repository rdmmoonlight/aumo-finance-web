using System.Globalization;
using System.Security.Claims;
using AumoFinance.Models;
using AumoFinance.Services;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.JSInterop;

namespace AumoFinance.Components.Pages.ChartOfAccounts;

public partial class ChartOfAccountsPage : ComponentBase
{
    [Inject] protected AppDbContext DbContext { get; set; } = default!;
    [Inject] protected IJSRuntime JS { get; set; } = default!;
    [Inject] protected AuthenticationStateProvider AuthStateProvider { get; set; } = default!;
    [Inject] protected NavigationManager Nav { get; set; } = default!;

    protected Guid UserId { get; private set; }
    protected static readonly CultureInfo CultureId = new("id-ID");

    protected static readonly string[] AccountTypes =
    {
        "Assets", "Liabilities", "Equity", "OperatingIncome",
        "OperatingExpenses", "OtherIncome", "OtherExpenses"
    };

    protected List<ChartOfAccount> accounts = new();
    protected string? successMessage;
    protected string? errorMessage;
    protected string searchText = string.Empty;
    protected string categoryFilter = string.Empty;

    protected ChartOfAccount newAccount = new() { Role = "Default" };
    protected ChartOfAccount editAccount = new();
    protected string? createError;
    protected string? editError;

    protected override async Task OnInitializedAsync()
    {
        var authState = await AuthStateProvider.GetAuthenticationStateAsync();
        var user = authState.User;

        if (user.Identity?.IsAuthenticated == true)
        {
            var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var parsedId))
            {
                UserId = parsedId;
                await LoadAccountsAsync();
                return;
            }
        }

        Nav.NavigateTo("/Account/Login", true);
    }

    protected async Task LoadAccountsAsync()
    {
        if (UserId == Guid.Empty) return;

        var loaded = await DbContext.ChartOfAccounts
            .Where(a => a.UserId == UserId)
            .OrderBy(a => a.ReferenceNumber)
            .ToListAsync();

        var accountIds = loaded.Select(a => a.Id).ToList();

        var currentPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(DbContext, UserId);

        if (currentPeriod == null)
        {
            foreach (var account in loaded)
            {
                account.Balance = 0;
            }
        }
        else
        {
            var accountBalances = await DbContext.JournalEntryLines
                .Where(j => accountIds.Contains(j.AccountId) &&
                            j.JournalEntry != null &&
                            j.JournalEntry.EntryDate >= currentPeriod.StartDate &&
                            j.JournalEntry.EntryDate <= currentPeriod.EndDate)
                .GroupBy(j => j.AccountId)
                .Select(g => new
                {
                    AccountId = g.Key,
                    TotalDebit = g.Sum(j => j.Debit),
                    TotalCredit = g.Sum(j => j.Credit)
                })
                .ToDictionaryAsync(x => x.AccountId);

            foreach (var account in loaded)
            {
                if (accountBalances.TryGetValue(account.Id, out var balance))
                {
                    account.Balance = AccountClassification.NormalBalanceIsDebit(account.Type)
                        ? balance.TotalDebit - balance.TotalCredit
                        : balance.TotalCredit - balance.TotalDebit;
                }
                else
                {
                    account.Balance = 0;
                }
            }
        }

        accounts = loaded;
    }

    protected IEnumerable<ChartOfAccount> FilteredAccounts => accounts.Where(a =>
        (string.IsNullOrWhiteSpace(searchText)
            || a.AccountName.Contains(searchText, StringComparison.OrdinalIgnoreCase)
            || a.ReferenceNumber.ToString().Contains(searchText))
        && (string.IsNullOrWhiteSpace(categoryFilter) || a.Type == categoryFilter));

    protected static string FormatCategoryLabel(string type) => type switch
    {
        "Assets" => "Assets (100 - 199)",
        "Liabilities" => "Liabilities (200 - 299)",
        "Equity" => "Equity (300 - 399)",
        "OperatingIncome" => "Operating Income (400 - 499)",
        "OperatingExpenses" => "Operating Expenses (500 - 599)",
        "OtherIncome" => "Other Income (600 - 799)",
        "OtherExpenses" => "Other Expenses (800 - 999)",
        _ => type
    };

    protected string GetLedgerUrl(ChartOfAccount account)
    {
        var action = AccountClassification.IsTemporary(account.Type) ? "GeneralLedgerTemporary" : "GeneralLedger";
        return $"/reports/general-ledger#account-{account.Id}";
    }

    protected async Task HandleCreate()
    {
        createError = null;

        if (!AccountClassification.ValidateReferenceNumber(newAccount.Type, newAccount.ReferenceNumber))
        {
            createError = $"Invalid reference number {newAccount.ReferenceNumber} for category {newAccount.Type}.";
            return;
        }

        bool isCodeTaken = await DbContext.ChartOfAccounts
            .AnyAsync(a => a.UserId == UserId && a.ReferenceNumber == newAccount.ReferenceNumber);
        if (isCodeTaken)
        {
            createError = $"Account code {newAccount.ReferenceNumber} is already in use!";
            return;
        }

        newAccount.UserId = UserId;
        newAccount.IsActive = true;
        newAccount.Balance = 0;

        try
        {
            DbContext.ChartOfAccounts.Add(newAccount);
            await DbContext.SaveChangesAsync();
            successMessage = $"Account '{newAccount.AccountName}' successfully created.";
            await JS.InvokeVoidAsync("aumoModal.hide", "addAccountModal");
            newAccount = new ChartOfAccount { Role = "Default" };
            await LoadAccountsAsync();
        }
        catch (Exception)
        {
            createError = "A fatal error occurred while saving the account.";
        }
    }

    protected void OpenEditModal(ChartOfAccount account)
    {
        editError = null;
        editAccount = new ChartOfAccount
        {
            Id = account.Id,
            ReferenceNumber = account.ReferenceNumber,
            AccountName = account.AccountName,
            Type = account.Type,
            Role = account.Role,
            IsActive = account.IsActive,
            UserId = account.UserId
        };
    }

    protected async Task HandleEdit()
    {
        editError = null;

        var account = await DbContext.ChartOfAccounts
            .FirstOrDefaultAsync(a => a.Id == editAccount.Id && a.UserId == UserId);
        if (account == null)
        {
            editError = "Account not found.";
            return;
        }

        if (!AccountClassification.ValidateReferenceNumber(editAccount.Type, editAccount.ReferenceNumber))
        {
            editError = $"Invalid reference number {editAccount.ReferenceNumber} for category {editAccount.Type}.";
            return;
        }

        bool isCodeTaken = await DbContext.ChartOfAccounts
            .AnyAsync(a => a.UserId == UserId && a.ReferenceNumber == editAccount.ReferenceNumber && a.Id != editAccount.Id);
        if (isCodeTaken)
        {
            editError = $"Account code {editAccount.ReferenceNumber} is already in use!";
            return;
        }

        account.ReferenceNumber = editAccount.ReferenceNumber;
        account.AccountName = editAccount.AccountName;
        account.Type = editAccount.Type;
        account.Role = editAccount.Role;
        account.IsActive = editAccount.IsActive;

        try
        {
            await DbContext.SaveChangesAsync();
            successMessage = $"Account '{account.AccountName}' successfully updated.";
            await JS.InvokeVoidAsync("aumoModal.hide", "editAccountModal");
            await LoadAccountsAsync();
        }
        catch (Exception)
        {
            editError = "A fatal error occurred while updating the account.";
        }
    }

    protected async Task ConfirmAndDelete(ChartOfAccount account)
    {
        var confirmed = await JS.InvokeAsync<bool>("confirm",
            $"Delete account \"{account.AccountName}\"? This action cannot be undone.");
        if (!confirmed) return;

        var entity = await DbContext.ChartOfAccounts
            .FirstOrDefaultAsync(a => a.Id == account.Id && a.UserId == UserId);
        if (entity == null)
        {
            errorMessage = "Account not found.";
            return;
        }

        bool hasJournalLines = await DbContext.JournalEntryLines.AnyAsync(l => l.AccountId == account.Id);
        if (hasJournalLines)
        {
            errorMessage = $"Account '{entity.AccountName}' cannot be deleted because it already has journal entries. Set it to Inactive instead.";
            return;
        }

        try
        {
            DbContext.ChartOfAccounts.Remove(entity);
            await DbContext.SaveChangesAsync();
            successMessage = $"Account '{entity.AccountName}' successfully deleted.";
            await LoadAccountsAsync();
        }
        catch (Exception)
        {
            errorMessage = "A fatal error occurred while deleting the account.";
        }
    }
}
