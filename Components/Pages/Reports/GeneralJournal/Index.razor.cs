using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;
using JournalEntryEntity = AumoFinance.Models.JournalEntry;

namespace AumoFinance.Components.Pages.Reports.GeneralJournal;

public partial class Index
{

    private static readonly CultureInfo Idr = new("id-ID");

    [CascadingParameter]
    private Task<AuthenticationState>? AuthStateTask { get; set; }

    private Guid UserId { get; set; }
    private List<JournalEntryEntity> entries = new();
    private Period? selectedPeriod;
    private bool editMode;

    protected override async Task OnInitializedAsync()
    {
        if (AuthStateTask != null)
        {
            var authState = await AuthStateTask;
            var user = authState.User;

            if (user.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (Guid.TryParse(userIdClaim, out var parsedGuid))
                {
                    UserId = parsedGuid;
                }
            }
        }

        if (UserId == Guid.Empty) return;

        selectedPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(DbContext, UserId);

        if (selectedPeriod == null)
        {
            entries = new List<JournalEntryEntity>();
            return;
        }

        entries = await DbContext.JournalEntries
            .Include(j => j.Lines)
                .ThenInclude(l => l.Account)
            .Where(j => j.UserId == UserId
                     && j.EntryDate >= selectedPeriod.StartDate
                     && j.EntryDate <= selectedPeriod.EndDate)
            .OrderBy(j => j.EntryDate)
            .ThenBy(j => j.CreatedAt)
            .ThenBy(j => j.Id)
            .ToListAsync();
    }

    private void ToggleEditMode() => editMode = !editMode;

    private async Task DeleteEntry(JournalEntryEntity entry)
    {
        var closedPeriods = await DbContext.Periods
            .Where(p => p.UserId == UserId && p.IsClosed)
            .ToListAsync();

        if (PeriodLock.IsDateLocked(entry.EntryDate, closedPeriods))
        {
            await JS.InvokeVoidAsync("alert", $"Journal entry {TransactionNumberFormatter.ToDisplay(entry.TransactionNumber)} is in a closed period and cannot be deleted.");
            return;
        }

        var confirmed = await JS.InvokeAsync<bool>("confirm", $"Delete journal entry {TransactionNumberFormatter.ToDisplay(entry.TransactionNumber)}? This action cannot be undone.");
        if (!confirmed) return;

        var tracked = await DbContext.JournalEntries
            .FirstOrDefaultAsync(j => j.Id == entry.Id && j.UserId == UserId);

        if (tracked == null) return;

        DbContext.JournalEntries.Remove(tracked);
        await DbContext.SaveChangesAsync();

        entries.Remove(entry);
        StateHasChanged();
    }
}
