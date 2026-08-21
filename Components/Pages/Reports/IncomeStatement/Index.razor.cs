using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

using TrialBalanceReport = AumoFinance.Components.Pages.Reports.TrialBalance.Index;

namespace AumoFinance.Components.Pages.Reports.IncomeStatement;

public partial class Index
{

    private static readonly CultureInfo Idr = new("id-ID");

    [CascadingParameter]
    private Task<AuthenticationState>? AuthStateTask { get; set; }

    private Guid UserId { get; set; }
    private IncomeStatementViewModel vm = new();
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
        vm = BuildIncomeStatement(rows, period);
    }

    public static IncomeStatementViewModel BuildIncomeStatement(List<TrialBalanceRow> rows, Period period)
    {
        var result = new IncomeStatementViewModel { AsOfDate = period.EndDate };

        IncomeStatementLine ToLine(TrialBalanceRow r) => new()
        {
            ReferenceNumber = r.ReferenceNumber,
            AccountName = r.AccountName,
            Amount = r.NetBalance
        };

        result.Revenues = rows.Where(r => r.Type == "OperatingIncome").Select(ToLine).ToList();
        result.OperatingExpenses = rows.Where(r => r.Type == "OperatingExpenses").Select(ToLine).ToList();
        result.OtherIncome = rows.Where(r => r.Type == "OtherIncome").Select(ToLine).ToList();
        result.OtherExpenses = rows.Where(r => r.Type == "OtherExpenses").Select(ToLine).ToList();

        return result;
    }
}
