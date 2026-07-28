using AumoFinance.Models;
using AumoFinance.Services;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 1. Database Context — Neon (PostgreSQL). Tidak ada lagi SQLite.
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2. ASP.NET Core Identity — single source of truth for accounts. Replaces
//    the old cookie-plus-external-JWT-API setup entirely: no more custom
//    User table, no more remote Aumo.Api calls for auth.
builder.Services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
{
    options.SignIn.RequireConfirmedAccount = false;
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
})
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders()
    .AddClaimsPrincipalFactory<AumoUserClaimsPrincipalFactory>();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Auth/Login";
    options.AccessDeniedPath = "/Auth/Login";
    options.ExpireTimeSpan = TimeSpan.FromDays(30);
    options.SlidingExpiration = true;
});

builder.Services.AddTransient<IEmailSender, MailKitEmailSender>();

// Lightweight in-process cache, used to throttle the anonymous
// /Auth/ResendVerification endpoint so it can't be spammed to email-bomb
// arbitrary addresses or burn through the SMTP sender's daily quota.
builder.Services.AddMemoryCache();

// Trust Railway's edge proxy so Request.Scheme resolves to "https" (from
// X-Forwarded-Proto) instead of "http". Without this, every link built with
// Url.Action(..., Request.Scheme) — including the email confirmation and
// password reset links — comes out as an http:// URL in production.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Railway's proxy IP isn't fixed/known ahead of time, so clear the
    // default known-network/proxy allowlist to accept its forwarded headers.
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// 3. MVC Services + Kunci Semua Halaman Secara Global
builder.Services.AddControllersWithViews(options =>
{
    // Ini mengunci SELURUH Controller dan Action secara default
    var policy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
    options.Filters.Add(new AuthorizeFilter(policy));
});

// 4. Optional Google external login
var googleClientId = builder.Configuration["Authentication:Google:ClientId"]
    ?? builder.Configuration["Google:ClientId"];
var googleClientSecret = builder.Configuration["Authentication:Google:ClientSecret"]
    ?? builder.Configuration["Google:ClientSecret"];

if (!string.IsNullOrWhiteSpace(googleClientId) && !string.IsNullOrWhiteSpace(googleClientSecret))
{
    builder.Services.AddAuthentication()
        .AddGoogle(GoogleDefaults.AuthenticationScheme, googleOptions =>
        {
            googleOptions.ClientId = googleClientId;
            googleOptions.ClientSecret = googleClientSecret;
            googleOptions.SignInScheme = IdentityConstants.ExternalScheme;
        });
}

var app = builder.Build();

// Must run before anything that inspects Request.Scheme/Host (exception
// handler, HSTS, HTTPS redirection, auth, and the auth email links).
app.UseForwardedHeaders();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
