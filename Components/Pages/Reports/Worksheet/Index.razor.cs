using TrialBalanceReport = AumoFinance.Components.Pages.Reports.TrialBalance.Index;

namespace AumoFinance.Components.Pages.Reports.Worksheet;

public partial class Index
{

    private static readonly CultureInfo Idr = new("id-ID");

    [CascadingParameter]
    private Task<AuthenticationState>? AuthStateTask { get; set; }

    private Guid UserId { get; set; }
    private WorksheetViewModel vm = new();
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

        var unadjusted = await TrialBalanceReport.BuildTrialBalanceRowsAsync(DbContext, UserId, period, includeAdjusting: false);
        var adjusted = await TrialBalanceReport.BuildTrialBalanceRowsAsync(DbContext, UserId, period, includeAdjusting: true);

        var accounts = await DbContext.ChartOfAccounts.Where(a => a.IsActive && a.UserId == UserId).OrderBy(a => a.ReferenceNumber).ToListAsync();

        var newVm = new WorksheetViewModel();
        var allRefs = unadjusted.Select(r => r.AccountId)
            .Union(adjusted.Select(r => r.AccountId))
            .ToList();

        foreach (var accountId in allRefs)
        {
            var account = accounts.First(a => a.Id == accountId);
            var u = unadjusted.FirstOrDefault(r => r.AccountId == accountId);
            var a = adjusted.FirstOrDefault(r => r.AccountId == accountId);
            var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);

            var uDebit = u?.Debit ?? 0;
            var uCredit = u?.Credit ?? 0;
            var aDebit = a?.Debit ?? 0;
            var aCredit = a?.Credit ?? 0;

            var adjNet = (aDebit - aCredit) - (uDebit - uCredit);

            var row = new WorksheetRow
            {
                AccountId = accountId,
                ReferenceNumber = account.ReferenceNumber,
                AccountName = account.AccountName,
                Type = account.Type,
                NormalBalanceIsDebit = normalDebit,
                UnadjustedDebit = uDebit,
                UnadjustedCredit = uCredit,
                AdjustmentDebit = adjNet > 0 ? adjNet : 0,
                AdjustmentCredit = adjNet < 0 ? -adjNet : 0,
                AdjustedDebit = aDebit,
                AdjustedCredit = aCredit
            };

            var isTemporary = AccountClassification.IsTemporary(account.Type);
            if (isTemporary)
            {
                row.IncomeStatementDebit = aDebit;
                row.IncomeStatementCredit = aCredit;
            }
            else
            {
                row.FinancialPositionDebit = aDebit;
                row.FinancialPositionCredit = aCredit;
            }

            newVm.Rows.Add(row);
        }

        newVm.Rows = newVm.Rows.OrderBy(r => r.ReferenceNumber).ToList();
        newVm.NetIncome = newVm.TotalIncomeStatementCredit - newVm.TotalIncomeStatementDebit;

        vm = newVm;
    }
}
