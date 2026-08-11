using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
using Microsoft.AspNetCore.Identity;
using AumoFinance.Models;

namespace AumoFinance.Components.Pages.Settings
{
    public partial class SettingsPage
    {
        protected ApplicationUser? CurrentUser { get; set; }
        protected bool IsEmailConfirmed => CurrentUser?.EmailConfirmed ?? false;
        protected string UserEmail => CurrentUser?.Email ?? "N/A";
        protected string UserFullName => CurrentUser?.FullName ?? CurrentUser?.UserName ?? "Unknown";
        protected string UserName => CurrentUser?.UserName ?? "Unknown";

        protected bool isDarkMode = true;
        protected bool enableSystemAlerts = true;
        protected string toastMessage = "Settings saved successfully.";

        protected override async Task OnInitializedAsync()
        {
            var authState = await AuthStateProvider.GetAuthenticationStateAsync();
            var user = authState.User;

            if (user.Identity?.IsAuthenticated == true)
            {
                var userId = UserManager.GetUserId(user);
                if (userId != null)
                {
                    CurrentUser = await UserManager.FindByIdAsync(userId);
                }
            }
        }

        protected override async Task OnAfterRenderAsync(bool firstRender)
        {
            if (firstRender)
            {
                try
                {
                    var savedTheme = await JS.InvokeAsync<string?>("localStorage.getItem", "aumo_theme");
                    isDarkMode = string.IsNullOrEmpty(savedTheme) || savedTheme == "dark";
                    StateHasChanged();
                }
                catch
                {
                    isDarkMode = true;
                }
            }
        }

        protected async Task OnThemeChanged(ChangeEventArgs e)
        {
            isDarkMode = e.Value is bool val ? val : Convert.ToBoolean(e.Value);
            var selectedTheme = isDarkMode ? "dark" : "light";

            try
            {
                await JS.InvokeVoidAsync("setAppTheme", selectedTheme);
            }
            catch
            {
                await JS.InvokeVoidAsync("document.documentElement.setAttribute", "data-bs-theme", selectedTheme);
                await JS.InvokeVoidAsync("localStorage.setItem", "aumo_theme", selectedTheme);
            }

            await ShowToast($"Theme changed to {selectedTheme} mode.");
        }

        protected async Task OnSystemAlertsChanged(ChangeEventArgs e)
        {
            enableSystemAlerts = e.Value is bool val ? val : Convert.ToBoolean(e.Value);
            var status = enableSystemAlerts ? "enabled" : "disabled";
            await ShowToast($"System alerts {status}.");
        }

        private async Task ShowToast(string message)
        {
            toastMessage = message;
            StateHasChanged();

            try
            {
                await JS.InvokeVoidAsync("aumoToast.show", "settingsToast");
            }
            catch
            {
                // Fallback jika library toast belum terload
            }
        }
    }
}
