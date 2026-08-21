using TrialBalanceReport = AumoFinance.Components.Pages.Reports.TrialBalance.Index;

namespace AumoFinance.Components.Pages.Reports.AdjustedTrialBalance;

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
        rows = await TrialBalanceReport.BuildTrialBalanceRowsAsync(DbContext, UserId, period, includeAdjusting: true);
    }
}
