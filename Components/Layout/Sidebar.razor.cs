using Microsoft.AspNetCore.Components;

namespace AumoFinance.Components.Layout
{
    public partial class Sidebar
    {
        private bool showReportsFlyout = false;
        private bool isExpanded = false;

        private void ToggleReportsFlyout()
        {
            showReportsFlyout = !showReportsFlyout;
        }

        private void CloseFlyout()
        {
            showReportsFlyout = false;
        }

        private void ToggleExpand()
        {
            isExpanded = !isExpanded;
        }
    }
}
