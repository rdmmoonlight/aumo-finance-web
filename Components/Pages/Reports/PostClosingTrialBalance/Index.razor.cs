using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

using SofpReport = AumoFinance.Components.Pages.Reports.StatementOfFinancialPosition.Index;

namespace AumoFinance.Components.Pages.Reports.PostClosingTrialBalance;

public partial class Index
{

    private static readonly CultureInfo Idr = new("id-ID");

    [CascadingParameter]
    private Task<AuthenticationState>? AuthStateTask { get; set; }

    private Guid UserId { get; set; }
    private StatementOfFinancialPositionViewModel vm = new();
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

        vm = await SofpReport.BuildSofpAsync(DbContext, UserId, period, isPostClosing: true);
    }
}
