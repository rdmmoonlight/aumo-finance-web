using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

using RetainedEarningsReport = AumoFinance.Components.Pages.Reports.RetainedEarnings.Index;
using TrialBalanceReport = AumoFinance.Components.Pages.Reports.TrialBalance.Index;

namespace AumoFinance.Components.Pages.Reports.StatementOfFinancialPosition;

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

        vm = await BuildSofpAsync(DbContext, UserId, period, isPostClosing: false);
    }

    public static async Task<StatementOfFinancialPositionViewModel> BuildSofpAsync(AppDbContext db, Guid userId, Period period, bool isPostClosing)
    {
        var rows = await TrialBalanceReport.BuildTrialBalanceRowsAsync(db, userId, period, includeAdjusting: true);
        var re = await RetainedEarningsReport.BuildRetainedEarningsAsync(db, userId, period);

        FinancialPositionLine ToLine(TrialBalanceRow r) => new()
        {
            ReferenceNumber = r.ReferenceNumber,
            AccountName = r.AccountName,
            Amount = r.NetBalance
        };

        return new StatementOfFinancialPositionViewModel
        {
            AsOfDate = period.EndDate,
            IsPostClosing = isPostClosing,
            Assets = rows.Where(r => r.Type == "Assets").Select(ToLine).ToList(),
            Liabilities = rows.Where(r => r.Type == "Liabilities").Select(ToLine).ToList(),
            EquityExcludingRetainedEarnings = rows.Where(r => r.Type == "Equity" && r.Role != "RetainedEarnings").Select(ToLine).ToList(),
            RetainedEarningsEnding = re.EndingBalance
        };
    }
}
