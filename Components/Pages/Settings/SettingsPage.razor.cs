@using Microsoft.AspNetCore.Components
@using Microsoft.JSInterop
@using Microsoft.AspNetCore.Identity
@using AumoFinance.Models

@inject IJSRuntime JS
@inject UserManager<ApplicationUser> UserManager
@inject AuthenticationStateProvider AuthStateProvider

<h3>Settings</h3>

<!-- ===== USER PROFILE SECTION ===== -->
<div class="card mb-4">
    <div class="card-header bg-primary text-white">
        <h5 class="mb-0">👤 User Profile</h5>
    </div>
    <div class="card-body">
        <div class="row">
            <div class="col-md-6">
                <dl class="row">
                    <dt class="col-sm-4">Full Name</dt>
                    <dd class="col-sm-8">@UserFullName</dd>

                    <dt class="col-sm-4">Username</dt>
                    <dd class="col-sm-8">@UserName</dd>

                    <dt class="col-sm-4">Email</dt>
                    <dd class="col-sm-8">@UserEmail</dd>

                    <dt class="col-sm-4">Email Status</dt>
                    <dd class="col-sm-8">
                        <span class="badge @(IsEmailConfirmed ? "bg-success" : "bg-warning text-dark")">
                            @(IsEmailConfirmed ? "Confirmed" : "Not Confirmed")
                        </span>
                    </dd>

                    <dt class="col-sm-4">Phone</dt>
                    <dd class="col-sm-8">@(CurrentUser?.PhoneNumber ?? "N/A")</dd>

                    <dt class="col-sm-4">2FA Enabled</dt>
                    <dd class="col-sm-8">
                        <span class="badge @(CurrentUser?.TwoFactorEnabled == true ? "bg-success" : "bg-secondary")">
                            @(CurrentUser?.TwoFactorEnabled == true ? "Enabled" : "Disabled")
                        </span>
                    </dd>
                </dl>
            </div>
        </div>
    </div>
</div>

<!-- ===== SETTINGS SECTION ===== -->
<div class="card">
    <div class="card-header bg-primary text-white">
        <h5 class="mb-0">⚙️ Preferences</h5>
    </div>
    <div class="card-body">
        <!-- Theme Toggle -->
        <div class="mb-3">
            <label class="form-label">Theme</label>
            <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="themeToggle"
                       @bind="isDarkMode" @bind-event="oninput" @oninput="OnThemeChanged" />
                <label class="form-check-label" for="themeToggle">
                    @(isDarkMode ? "🌙 Dark Mode" : "☀️ Light Mode")
                </label>
            </div>
        </div>

        <!-- System Alerts Toggle -->
        <div class="mb-3">
            <label class="form-label">System Alerts</label>
            <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="alertsToggle"
                       @bind="enableSystemAlerts" @bind-event="oninput" @oninput="OnSystemAlertsChanged" />
                <label class="form-check-label" for="alertsToggle">
                    @(enableSystemAlerts ? "Enabled" : "Disabled")
                </label>
            </div>
        </div>
    </div>
</div>

<!-- Toast Notification -->
<div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div id="settingsToast" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header bg-primary text-white">
            <strong class="me-auto">Settings</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            @toastMessage
        </div>
    </div>
</div>

@code {
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
        isDarkMode = (bool)(e.Value ?? true);
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
            // Fallback jika library toast belum terload
        }
    }
}
