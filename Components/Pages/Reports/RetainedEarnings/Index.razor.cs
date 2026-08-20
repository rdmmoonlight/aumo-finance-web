using TrialBalanceReport = AumoFinance.Components.Pages.Reports.TrialBalance.Index;
using IncomeStatementReport = AumoFinance.Components.Pages.Reports.IncomeStatement.Index;

namespace AumoFinance.Components.Pages.Reports.RetainedEarnings;

public partial class Index
{

    private static readonly CultureInfo Idr = new("id-ID");

    [CascadingParameter]
    private Task<AuthenticationState>? AuthStateTask { get; set; }

    private Guid UserId { get; set; }
    private RetainedEarningsViewModel vm = new();
    private bool noPeriodSelected;

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

        vm = await BuildRetainedEarningsAsync(DbContext, UserId, period);
    }

    public static async Task<RetainedEarningsViewModel> BuildRetainedEarningsAsync(AppDbContext db, Guid userId, Period period)
    {
        var rows = await TrialBalanceReport.BuildTrialBalanceRowsAsync(db, userId, period, includeAdjusting: true);
        var incomeStatement = IncomeStatementReport.BuildIncomeStatement(rows, period);
        var reAccount = rows.FirstOrDefault(r => r.Role == "RetainedEarnings");

        return new RetainedEarningsViewModel
        {
            AccountName = reAccount?.AccountName ?? "Retained Earnings",
            StartDate = period.StartDate,
            EndDate = period.EndDate,
            BeginningBalance = reAccount?.NetBalance ?? 0,
            NetIncome = incomeStatement.NetIncome,
            Dividends = 0
        };
    }
}
