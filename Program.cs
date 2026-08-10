using System.Text;
using AumoFinance.Components;
using AumoFinance.Controllers.Api;
using AumoFinance.Models;
using AumoFinance.Services;
using AumoFinance.Services.Security;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);


// =====================================
// 1. DATABASE CONFIGURATION (PostgreSQL)
// =====================================

builder.Services.AddDbContextFactory<AppDbContext>(options =>
{
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
    );

    options.ConfigureWarnings(w =>
        w.Ignore(
            Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId
                .PendingModelChangesWarning
        )
    );
});

builder.Services.AddScoped(sp =>
    sp.GetRequiredService<IDbContextFactory<AppDbContext>>()
        .CreateDbContext());


// =====================================
// 2. DATA PROTECTION & PERSISTENCE
// =====================================

builder.Services.AddDataProtection()
    .PersistKeysToDbContext<AppDbContext>()
    .SetApplicationName("AumoFinanceApp");


// =====================================
// 3. ASP.NET CORE IDENTITY SETUP
// =====================================

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
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
// 4. AUTHENTICATION
// Cookie, JWT & OAuth
// =====================================

var authBuilder = builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme =
        IdentityConstants.ApplicationScheme;

    options.DefaultSignInScheme =
        IdentityConstants.ExternalScheme;
})
.AddJwtBearer(
    JwtBearerDefaults.AuthenticationScheme,
    options =>
    {
        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,

                ValidIssuer = AuthController.JwtIssuer,
                ValidAudience = AuthController.JwtIssuer,

                IssuerSigningKey =
                    new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(
                            AuthController.JwtSecretKey
                        )
                    )
            };
    });


// =====================================
// GOOGLE OAUTH
// Optional Configuration
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
    authBuilder.AddGoogle(
        GoogleDefaults.AuthenticationScheme,
        options =>
        {
            options.ClientId = googleClientId;
            options.ClientSecret = googleClientSecret;

            options.SignInScheme =
                IdentityConstants.ExternalScheme;
        });
}


// =====================================
// 5. BLAZOR CORE & API CONTROLLERS
// =====================================

builder.Services.AddControllers();

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddCascadingAuthenticationState();


// =====================================
// 6. APPLICATION SERVICES & HEALTH CHECKS
// =====================================

builder.Services.AddHealthChecks();

// Render Keep-Alive
// Implementation berada di:
// Services/RenderKeepAliveService.cs
builder.Services.AddHostedService<RenderKeepAliveService>();


builder.Services.AddTransient<
    IEmailSender,
    MailKitEmailSender
>();

builder.Services.AddScoped<
    IGuardianService,
    GuardianService
>();

builder.Services.AddHttpClient<
    IAiService,
    AiService
>();

builder.Services.AddScoped<
    IJournalImportService,
    JournalImportService
>();

builder.Services.AddMemoryCache();

builder.Services.AddScoped<
    ICloudStorageService,
    CloudinaryService
>();

builder.Services.AddScoped<
    DashboardDataService
>();

builder.Services.AddHttpClient();


// =====================================
// 7. FORWARDED HEADERS
// Railway / Render / Proxy
// =====================================

builder.Services.Configure<ForwardedHeadersOptions>(
    options =>
    {
        options.ForwardedHeaders =
            ForwardedHeaders.XForwardedFor |
            ForwardedHeaders.XForwardedProto;

        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
    });


// =====================================
// BUILD APPLICATION
// =====================================

var app = builder.Build();


// =====================================
// 8. AUTOMATIC DATABASE MIGRATION
// =====================================

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;

    try
    {
        var context =
            services.GetRequiredService<AppDbContext>();

        context.Database.Migrate();
    }
    catch (Exception ex)
    {
        var logger =
            services.GetRequiredService<
                ILogger<Program>
            >();

        logger.LogError(
            ex,
            "Failed to run automatic database migration."
        );
    }
}


// =====================================
// 9. HTTP PIPELINE MIDDLEWARE
// =====================================

app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseHsts();
}

app.UseStaticFiles();

app.UseAntiforgery();

app.UseAuthentication();

app.UseAuthorization();


// =====================================
// 10. HEALTH CHECK
// =====================================
//
// Public lightweight endpoint:
//
// GET /health
//
// Used by Render Keep-Alive / monitoring.
//

app.MapHealthChecks("/health");


// =====================================
// 11. AUTH LOGOUT
// =====================================

app.MapPost(
    "/auth/logout",
    async (
        SignInManager<ApplicationUser> signInManager
    ) =>
    {
        await signInManager.SignOutAsync();

        return Results.Redirect("/auth/login");
    });


// =====================================
// 12. API CONTROLLERS
// =====================================

app.MapControllers();


// =====================================
// 13. BLAZOR RAZOR COMPONENTS
// =====================================

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();


// =====================================
// 14. RUN
// =====================================

app.Run();
