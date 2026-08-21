using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

using IncomeStatementReport = AumoFinance.Components.Pages.Reports.IncomeStatement.Index;
using TrialBalanceReport = AumoFinance.Components.Pages.Reports.TrialBalance.Index;

namespace AumoFinance.Components.Pages.Reports.StatementOfCashFlows;

public partial class Index
{

    private static readonly CultureInfo Idr = new("id-ID");

    [CascadingParameter]
    private Task<AuthenticationState>? AuthStateTask { get; set; }

    private Guid UserId { get; set; }
    private CashFlowStatementViewModel vm = new();
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

        var cashRows = rows.Where(r => r.Role == "CashAndEquivalents").ToList();
        decimal endingCash = cashRows.Sum(r => r.NetBalance);

        var newVm = new CashFlowStatementViewModel
        {
            OperatingActivities = new List<CashFlowLine>
            {
                new CashFlowLine
                {
                    Description = "Net Income per Income Statement",
                    Amount = incomeStatement.NetIncome
                }
            }
        };

        foreach (var r in rows)
        {
            if (r.NetBalance == 0 || r.Role == "CashAndEquivalents" || r.Role == "RetainedEarnings")
                continue;

            if (AccountClassification.IsTemporary(r.Type) || r.ReferenceNumber >= 400)
                continue;

            if (r.Type == "Assets" || (r.ReferenceNumber >= 100 && r.ReferenceNumber <= 199))
            {
                bool isFixedAsset = r.ReferenceNumber >= 150 ||
                                   r.AccountName.Contains("Equipment", StringComparison.OrdinalIgnoreCase) ||
                                   r.AccountName.Contains("Depreciation", StringComparison.OrdinalIgnoreCase) ||
                                   r.AccountName.Contains("Asset", StringComparison.OrdinalIgnoreCase);

                if (isFixedAsset)
                    newVm.InvestingActivities.Add(new CashFlowLine { Description = $"Capital expenditure / Sale of {r.AccountName}", Amount = -r.NetBalance });
                else
                    newVm.OperatingActivities.Add(new CashFlowLine { Description = $"Change in {r.AccountName}", Amount = -r.NetBalance });
            }
            else if (r.Type == "Liabilities" || (r.ReferenceNumber >= 200 && r.ReferenceNumber <= 299))
            {
                bool isLongTermDebt = r.ReferenceNumber >= 250 ||
                                      r.AccountName.Contains("Bank Loan", StringComparison.OrdinalIgnoreCase) ||
                                      r.AccountName.Contains("Long Term", StringComparison.OrdinalIgnoreCase);

                if (isLongTermDebt)
                    newVm.FinancingActivities.Add(new CashFlowLine { Description = $"Change in {r.AccountName}", Amount = r.NetBalance });
                else
                    newVm.OperatingActivities.Add(new CashFlowLine { Description = $"Change in {r.AccountName}", Amount = r.NetBalance });
            }
            else if (r.Type == "Equity" || (r.ReferenceNumber >= 300 && r.ReferenceNumber <= 399))
            {
                newVm.FinancingActivities.Add(new CashFlowLine { Description = $"Change in {r.AccountName}", Amount = r.NetBalance });
            }
            else
            {
                newVm.OperatingActivities.Add(new CashFlowLine { Description = $"Adjustment for {r.AccountName}", Amount = -r.NetBalance });
            }
        }

        newVm.BeginningCash = endingCash - newVm.NetChangeInCash;
        vm = newVm;
    }
}
