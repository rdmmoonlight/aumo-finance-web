using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace AumoFinance.Components.Pages.Settings;

public partial class SettingsPage : ComponentBase
{
    [Inject] protected IJSRuntime JS { get; set; } = default!;

    protected bool isDarkMode = true; // Default samakan dengan tema awal (Dark)
    protected bool enableSystemAlerts = true;
    protected string toastMessage = "Settings saved successfully.";

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            try
            {
                var savedTheme = await JS.InvokeAsync<string?>("localStorage.getItem", "aumo_theme");
                
                // Jika null (belum pernah diset), default ke "dark"
                isDarkMode = string.IsNullOrEmpty(savedTheme) || savedTheme == "dark";
                StateHasChanged();
            }
            catch
            {
                // Fallback aman untuk prerendering
                isDarkMode = true;
            }
        }
    }

    protected async Task OnThemeChanged(ChangeEventArgs e)
    {
        isDarkMode = (bool)(e.Value ?? true);
        var selectedTheme = isDarkMode ? "dark" : "light";

        // Panggil fungsi JS setAppTheme secara langsung tanpa eval
        try
        {
            await JS.InvokeVoidAsync("setAppTheme", selectedTheme);
        }
        catch
        {
            // Fallback jika window.setAppTheme gagal dipanggil
            await JS.InvokeVoidAsync("document.documentElement.setAttribute", "data-bs-theme", selectedTheme);
            await JS.InvokeVoidAsync("localStorage.setItem", "aumo_theme", selectedTheme);
        }

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
        
        try
        {
            await JS.InvokeVoidAsync("aumoToast.show", "settingsToast");
        }
        catch
        {
            // Abaikan jika library toast belum terload
        }
    }
}
