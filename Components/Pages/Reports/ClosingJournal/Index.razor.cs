using IncomeStatementReport = AumoFinance.Components.Pages.Reports.IncomeStatement.Index;

using TrialBalanceReport = AumoFinance.Components.Pages.Reports.TrialBalance.Index;

namespace AumoFinance.Components.Pages.Reports.ClosingJournal;

public partial class Index
{

    private static readonly CultureInfo Idr = new("id-ID");

    [CascadingParameter]
    private Task<AuthenticationState>? AuthStateTask { get; set; }

    private Guid UserId { get; set; }
    private ClosingJournalViewModel vm = new();
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

        var rows = await TrialBalanceReport.BuildTrialBalanceRowsAsync(DbContext, UserId, period, includeAdjusting: true);
        var incomeStatement = IncomeStatementReport.BuildIncomeStatement(rows, period);
        var reAccountName = rows.FirstOrDefault(r => r.Role == "RetainedEarnings")?.AccountName ?? "Retained Earnings";
        const string incomeSummaryName = "Income Summary";

        var newVm = new ClosingJournalViewModel
        {
            NetIncome = incomeStatement.NetIncome,
            RetainedEarningsAccountName = reAccountName
        };

        var incomeRows = rows.Where(r => r.Type == "OperatingIncome" || r.Type == "OtherIncome").Where(r => r.NetBalance != 0).ToList();
        var expenseRows = rows.Where(r => r.Type == "OperatingExpenses" || r.Type == "OtherExpenses").Where(r => r.NetBalance != 0).ToList();

        // BLOK 1: Closing Revenues to Income Summary
        if (incomeRows.Any())
        {
            var group1 = new ClosingJournalEntryGroup { Description = "Closing Revenue Accounts to Income Summary" };
            foreach (var r in incomeRows)
            {
                group1.Lines.Add(new ClosingJournalLine { ReferenceNumber = r.ReferenceNumber, AccountName = r.AccountName, Debit = r.NetBalance, Credit = 0 });
            }
            group1.Lines.Add(new ClosingJournalLine { AccountName = incomeSummaryName, Debit = 0, Credit = incomeRows.Sum(r => r.NetBalance) });
            newVm.Groups.Add(group1);
        }

        // BLOK 2: Closing Expenses to Income Summary
        if (expenseRows.Any())
        {
            var group2 = new ClosingJournalEntryGroup { Description = "Closing Expense Accounts to Income Summary" };
            group2.Lines.Add(new ClosingJournalLine { AccountName = incomeSummaryName, Debit = expenseRows.Sum(r => r.NetBalance), Credit = 0 });
            foreach (var r in expenseRows)
            {
                group2.Lines.Add(new ClosingJournalLine { ReferenceNumber = r.ReferenceNumber, AccountName = r.AccountName, Debit = 0, Credit = r.NetBalance });
            }
            newVm.Groups.Add(group2);
        }

        // BLOK 3: Closing Income Summary to Retained Earnings
        if (incomeStatement.NetIncome != 0)
        {
            var group3 = new ClosingJournalEntryGroup { Description = "Closing Income Summary to Retained Earnings" };

            if (incomeStatement.NetIncome > 0)
            {
                group3.Lines.Add(new ClosingJournalLine { AccountName = incomeSummaryName, Debit = incomeStatement.NetIncome, Credit = 0 });
                group3.Lines.Add(new ClosingJournalLine { AccountName = reAccountName, Debit = 0, Credit = incomeStatement.NetIncome });
            }
            else
            {
                var netLoss = Math.Abs(incomeStatement.NetIncome);
                group3.Lines.Add(new ClosingJournalLine { AccountName = reAccountName, Debit = netLoss, Credit = 0 });
                group3.Lines.Add(new ClosingJournalLine { AccountName = incomeSummaryName, Debit = 0, Credit = netLoss });
            }

            newVm.Groups.Add(group3);
        }

        vm = newVm;
    }
}
