namespace AumoFinance.Components.Pages.Reports.TrialBalance;

public partial class Index
{

    private static readonly CultureInfo Idr = new("id-ID");

    [CascadingParameter]
    private Task<AuthenticationState>? AuthStateTask { get; set; }

    private Guid UserId { get; set; }

    private List<TrialBalanceRow> rows = new();
    private bool noPeriodSelected;

    private decimal TotalDebit => rows.Sum(r => r.Debit);
    private decimal TotalCredit => rows.Sum(r => r.Credit);
    private bool IsBalanced => Math.Round(TotalDebit - TotalCredit, 2) == 0;

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

        await LoadDataAsync();
    }

    private async Task LoadDataAsync()
    {
        if (UserId == Guid.Empty)
        {
            noPeriodSelected = true;
            return;
        }

        var period = await SelectedPeriodHelper.GetSelectedPeriodAsync(DbContext, UserId);
        if (period == null)
        {
            noPeriodSelected = true;
            return;
        }

        noPeriodSelected = false;
        rows = await BuildTrialBalanceRowsAsync(period, includeAdjusting: false);
    }

    public static async Task<List<TrialBalanceRow>> BuildTrialBalanceRowsAsync(AppDbContext db, Guid userId, Period period, bool includeAdjusting)
    {
        var accounts = await db.ChartOfAccounts
            .Where(a => a.IsActive && a.UserId == userId)
            .OrderBy(a => a.ReferenceNumber)
            .ToListAsync();

        var accountIds = accounts.Select(a => a.Id).ToList();

        // Gunakan .Date agar perbandingan tidak terpengaruh jam/menit/Kind
        var start = period.StartDate.Date;
        var end = period.EndDate.Date;

        var linesQuery = db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Where(l => accountIds.Contains(l.AccountId)
                     && l.JournalEntry!.UserId == userId
                     && l.JournalEntry!.EntryDate.Date >= start
                     && l.JournalEntry!.EntryDate.Date <= end);

        // Hanya General (unadjusted) atau General + Adjusting (adjusted).
        // Closing journal tidak pernah dimasukkan.
        var lines = includeAdjusting
            ? await linesQuery.Where(l => l.JournalEntry!.JournalType == "General"
                                       || l.JournalEntry!.JournalType == "Adjusting")
                              .ToListAsync()
            : await linesQuery.Where(l => l.JournalEntry!.JournalType == "General")
                              .ToListAsync();

        var rows = new List<TrialBalanceRow>();
        foreach (var account in accounts)
        {
            var accountLines = lines.Where(l => l.AccountId == account.Id).ToList();

            // Lewati akun yang tidak memiliki transaksi di periode ini
            if (!accountLines.Any()) continue;

            var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);
            var netBalance = normalDebit
                ? accountLines.Sum(l => l.Debit - l.Credit)
                : accountLines.Sum(l => l.Credit - l.Debit);

            rows.Add(new TrialBalanceRow
            {
                AccountId = account.Id,
                ReferenceNumber = account.ReferenceNumber,
                AccountName = account.AccountName,
                Type = account.Type,
                Role = account.Role,
                NormalBalanceIsDebit = normalDebit,
                NetBalance = netBalance
            });
        }

        return rows;
    }

    private Task<List<TrialBalanceRow>> BuildTrialBalanceRowsAsync(Period period, bool includeAdjusting)
        => BuildTrialBalanceRowsAsync(DbContext, UserId, period, includeAdjusting);
}
