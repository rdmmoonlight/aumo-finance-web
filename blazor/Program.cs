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
// 4. AUTHENTICATION (Cookie, JWT & OAuth)
// =====================================

var authBuilder = builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = IdentityConstants.ApplicationScheme;
    options.DefaultSignInScheme = IdentityConstants.ExternalScheme;
})
.AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,

        ValidIssuer = AuthController.JwtIssuer,
        ValidAudience = AuthController.JwtIssuer,

        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(AuthController.JwtSecretKey)
        )
    };
});


// --- GOOGLE OAUTH CONFIGURATION ---
var googleClientId = builder.Configuration["Authentication:Google:ClientId"]
    ?? builder.Configuration["Google:ClientId"];

var googleClientSecret = builder.Configuration["Authentication:Google:ClientSecret"]
    ?? builder.Configuration["Google:ClientSecret"];

if (!string.IsNullOrWhiteSpace(googleClientId) && !string.IsNullOrWhiteSpace(googleClientSecret))
{
    authBuilder.AddGoogle(GoogleDefaults.AuthenticationScheme, options =>
    {
        options.ClientId = googleClientId;
        options.ClientSecret = googleClientSecret;
        options.SignInScheme = IdentityConstants.ExternalScheme;
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

// Render Keep-Alive Service
builder.Services.AddHostedService<RenderKeepAliveService>();

// --- EMAIL SERVICES REGISTRATION (RESEND API) ---
builder.Services.AddTransient<IEmailSender, ResendEmailSender>();

// Bridging Microsoft Identity's IEmailSender<TUser> to AumoFinance's IEmailSender
builder.Services.AddTransient<IEmailSender<ApplicationUser>, IdentityEmailSenderBridge>();

builder.Services.AddScoped<IGuardianService, GuardianService>();
builder.Services.AddHttpClient<IAiService, AiService>();
builder.Services.AddScoped<IJournalImportService, JournalImportService>();
builder.Services.AddScoped<ITransactionNumberService, TransactionNumberService>();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<ICloudStorageService, CloudinaryService>();
builder.Services.AddScoped<DashboardDataService>();

// --- MARKET SERVICE & HTTP CLIENT SETUP ---
builder.Services.AddHttpClient("MarketApiClient", client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AumoFinance/1.0");
});

builder.Services.AddScoped<IMarketService, MarketService>();
builder.Services.AddHttpClient();


// =====================================
// 7. FORWARDED HEADERS (Render / Reverse Proxy)
// =====================================

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
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
        var context = services.GetRequiredService<AppDbContext>();
        context.Database.Migrate();
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Failed to run automatic database migration.");
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

    // Sebelumnya production tidak punya exception handler sama sekali,
    // jadi error tak tertangani di controller (mis. kolom/tabel belum
    // dimigrasikan) menghasilkan body 500 KOSONG. Mobile/web yang
    // mem-parse body itu sebagai JSON lalu crash dengan
    // "JsonException: ExpectedJsonTokens ... LineNumber: 0" — pesan yang
    // membingungkan dan menyembunyikan error aslinya. Middleware ini
    // memastikan setiap 500 tak tertangani tetap mengirim JSON yang bisa
    // dibaca, plus tercatat di log server untuk didiagnosis.
    app.Use(async (context, next) =>
    {
        try
        {
            await next();
        }
        catch (Exception ex)
        {
            var logger = app.Services.GetRequiredService<ILogger<Program>>();
            logger.LogError(ex, "Unhandled exception on {Path}", context.Request.Path);

            if (!context.Response.HasStarted)
            {
                context.Response.Clear();
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Terjadi kesalahan di server. Coba lagi beberapa saat lagi."
                });
            }
        }
    });
}

app.UseStaticFiles();

app.UseRouting();

app.UseAntiforgery();

app.UseAuthentication();

app.UseAuthorization();


// =====================================
// 10. ENDPOINTS & MAP CONTROLLERS
// =====================================

app.MapHealthChecks("/health");

app.MapPost("/auth/logout", async (SignInManager<ApplicationUser> signInManager) =>
{
    await signInManager.SignOutAsync();
    return Results.Redirect("/auth/login");
});

app.MapControllers();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();


// =====================================
// 11. RUN APPLICATION
// =====================================

app.Run();


// =====================================
// 12. IDENTITY EMAIL SENDER BRIDGE CLASS
// =====================================

/// <summary>
/// Bridge class to map Microsoft Identity's IEmailSender&lt;ApplicationUser&gt; 
/// to AumoFinance's custom IEmailSender service.
/// </summary>
public class IdentityEmailSenderBridge : IEmailSender<ApplicationUser>
{
    private readonly IEmailSender _emailSender;

    public IdentityEmailSenderBridge(IEmailSender emailSender)
    {
        _emailSender = emailSender;
    }

    public Task SendConfirmationLinkAsync(ApplicationUser user, string email, string confirmationLink)
    {
        var message = $"""
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Confirm Your Email</h2>
                <p>Hello {user.FullName ?? user.UserName},</p>
                <p>Please confirm your account email by clicking the link below:</p>
                <p><a href="{confirmationLink}" style="background-color: #0d6efd; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Confirm Email</a></p>
                <br/>
                <p>If you did not request this, please ignore this email.</p>
            </div>
            """;

        return _emailSender.SendEmailAsync(email, "Confirm your email - Aumo Finance", message);
    }

    public Task SendPasswordResetLinkAsync(ApplicationUser user, string email, string resetLink)
    {
        var message = $"""
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Reset Your Password</h2>
                <p>Hello {user.FullName ?? user.UserName},</p>
                <p>You can reset your password by clicking the link below:</p>
                <p><a href="{resetLink}" style="background-color: #0d6efd; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
            </div>
            """;

        return _emailSender.SendEmailAsync(email, "Reset your password - Aumo Finance", message);
    }

    public Task SendPasswordResetCodeAsync(ApplicationUser user, string email, string resetCode)
    {
        var message = $"""
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Reset Password Code</h2>
                <p>Hello {user.FullName ?? user.UserName},</p>
                <p>Your password reset code is: <strong>{resetCode}</strong></p>
            </div>
            """;

        return _emailSender.SendEmailAsync(email, "Password Reset Code - Aumo Finance", message);
    }
}
