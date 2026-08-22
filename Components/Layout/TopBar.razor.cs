using System;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoFinance.Models;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Components.Layout
{
    public partial class TopBar
    {
        [Inject]
        private IDbContextFactory<AppDbContext> DbFactory { get; set; } = default!;

        [Inject]
        private AuthenticationStateProvider AuthStateProvider { get; set; } = default!;

        private string? activePeriodName;
        private bool hasActivePeriod;
        private bool isViewingClosed;
        private string periodText = "No Period Selected";
        private string periodIconState = "none";

        protected override async Task OnInitializedAsync()
        {
            var authState = await AuthStateProvider.GetAuthenticationStateAsync();
            var user = authState.User;

            if (user.Identity != null && user.Identity.IsAuthenticated)
            {
                var currentUserIdStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
                if (Guid.TryParse(currentUserIdStr, out var currentUserId))
                {
                    await using var context = await DbFactory.CreateDbContextAsync();
                    var activePeriodObj = await context.Periods
                        .FirstOrDefaultAsync(p => p.UserId == currentUserId && p.IsSelected);

                    if (activePeriodObj != null)
                    {
                        activePeriodName = activePeriodObj.PeriodName;
                        hasActivePeriod = !string.IsNullOrEmpty(activePeriodName);
                        isViewingClosed = activePeriodObj.IsClosed;
                        periodText = hasActivePeriod ? activePeriodName : "No Period Selected";
                        periodIconState = !hasActivePeriod
                            ? "none"
                            : (isViewingClosed ? "locked" : "open");
                    }
                }
            }
        }
    }
}
