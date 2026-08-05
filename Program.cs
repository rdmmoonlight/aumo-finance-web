using AumoFinance.Components;
using AumoFinance.Models;
using AumoFinance.Services;
using AumoFinance.Services.Security;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// =====================================
// Database - PostgreSQL (DbContextFactory & Scoped)
// =====================================
builder.Services.AddDbContextFactory<AppDbContext>(options =>
{
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
    );
    options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
});

builder.Services.AddScoped(sp =>
    sp.GetRequiredService<IDbContextFactory<AppDbContext>>().CreateDbContext());

// =====================================
// Data Protection
// =====================================
builder.Services.AddDataProtection()
    .PersistKeysToDbContext<AppDbContext>()
    .SetApplicationName("AumoFinanceApp");

// =====================================
// ASP.NET Core Identity
// =====================================
builder.Services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
{
    options.SignIn.RequireConfirmedAccount = false;
    options.Password.RequiredLength = 6;
    options.Password.RequireDigit = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = false;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders()
.AddClaimsPrincipalFactory<AumoUserClaimsPrincipalFactory>();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/auth/login";
    options.AccessDeniedPath = "/auth/login";
    options.ExpireTimeSpan = TimeSpan.FromDays(30);
    options.SlidingExpiration = true;
});

// =====================================
// Blazor Core & Authentication State
// =====================================
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddCascadingAuthenticationState();

// =====================================
// Application Services
// =====================================
builder.Services.AddTransient<IEmailSender, MailKitEmailSender>();
builder.Services.AddScoped<IGuardianService, GuardianService>();
builder.Services.AddHttpClient<IAiService, AiService>();
builder.Services.AddScoped<IJournalImportService, JournalImportService>();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<ICloudStorageService, CloudinaryService>();
builder.Services.AddScoped<DashboardDataService>();
builder.Services.AddHttpClient();

// =====================================
// Forwarded Headers (Railway / Proxy)
// =====================================
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto;

    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// =====================================
// Google Login (Optional)
// =====================================
var googleClientId =
    builder.Configuration["Authentication:Google:ClientId"]
    ?? builder.Configuration["Google:ClientId"];

var googleClientSecret =
    builder.Configuration["Authentication:Google:ClientSecret"]
    ?? builder.Configuration["Google:ClientSecret"];

if (!string.IsNullOrWhiteSpace(googleClientId) &&
    !string.IsNullOrWhiteSpace(googleClientSecret))
{
    builder.Services
        .AddAuthentication()
        .AddGoogle(
            GoogleDefaults.AuthenticationScheme,
            options =>
            {
                options.ClientId = googleClientId;
                options.ClientSecret = googleClientSecret;
                options.SignInScheme = IdentityConstants.ExternalScheme;
            });
}

var app = builder.Build();

// =====================================
// AUTOMATIC DATABASE MIGRATION
// =====================================
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<AppDbContext>();
        context.Database.Migrate();
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Gagal menjalankan otomatisasi migrasi database.");
    }
}

// =====================================
// HTTP Pipeline
// =====================================
app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseStaticFiles();
app.UseAntiforgery();

app.UseAuthentication();
app.UseAuthorization();

// =====================================
// Routes Mapping
// =====================================

// Minimal API Endpoint khusus Logout (Dipanggil form di Sidebar.razor)
app.MapPost("/auth/logout", async (SignInManager<ApplicationUser> signInManager) =>
{
    await signInManager.SignOutAsync();
    return Results.Redirect("/auth/login");
});

// Entry point utama Blazor Web App
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
