namespace AumoFinance.Components.Pages.Reports.AdjustingJournal;

public partial class Index
{

    private static readonly CultureInfo Idr = new("id-ID");

    [CascadingParameter]
    private Task<AuthenticationState>? AuthStateTask { get; set; }

    private Guid UserId { get; set; }
    private List<JournalEntry> entries = new();
    private Period? selectedPeriod;

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
            entries = new List<JournalEntry>();
            return;
        }

        entries = await DbContext.JournalEntries
            .Include(j => j.Lines)
                .ThenInclude(l => l.Account)
            .Where(j => j.UserId == UserId
                     && j.JournalType == "Adjusting"
                     && j.EntryDate >= selectedPeriod.StartDate 
                     && j.EntryDate <= selectedPeriod.EndDate)
            .OrderBy(j => j.EntryDate)
            .ThenBy(j => j.CreatedAt)
            .ThenBy(j => j.Id)
            .ToListAsync();
    }
}
