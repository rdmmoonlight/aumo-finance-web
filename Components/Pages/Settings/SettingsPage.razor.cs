using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace AumoFinance.Components.Pages.Settings;

public partial class SettingsPage : ComponentBase
{
    [Inject] protected IJSRuntime JS { get; set; } = default!;

    protected bool isDarkMode = false;
    protected bool enableSystemAlerts = true;
    protected string toastMessage = "Settings saved successfully.";

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            var savedTheme = await JS.InvokeAsync<string?>("localStorage.getItem", "aumo_theme");
            if (savedTheme != null)
            {
                isDarkMode = (savedTheme == "dark");
                StateHasChanged();
            }
        }
    }

    protected async Task OnThemeChanged(ChangeEventArgs e)
    {
        isDarkMode = (bool)(e.Value ?? false);
        var selectedTheme = isDarkMode ? "dark" : "light";

        await JS.InvokeVoidAsync("eval", $@"
            if (typeof window.setAppTheme === 'function') {{
                window.setAppTheme('{selectedTheme}');
            }} else {{
                document.documentElement.setAttribute('data-bs-theme', '{selectedTheme}');
                localStorage.setItem('aumo_theme', '{selectedTheme}');
            }}
        ");

        await ShowToast($"Theme changed to {selectedTheme} mode.");
    }

    protected async Task OnSystemAlertsChanged(ChangeEventArgs e)
    {
        enableSystemAlerts = (bool)(e.Value ?? false);
        var status = enableSystemAlerts ? "enabled" : "disabled";
        await ShowToast($"System alerts {status}.");
    }

    private async Task ShowToast(string message)
    {
        toastMessage = message;
        StateHasChanged();
        await JS.InvokeVoidAsync("aumoToast.show", "settingsToast");
    }
}
