using AumoFinance.Models;
using AumoFinance.Services;
using AumoFinance.Services.Security;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);


// =====================================
// Database - Neon PostgreSQL
// =====================================

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
    ));



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
    options.LoginPath = "/Auth/Login";

    options.AccessDeniedPath = "/Auth/Login";

    options.ExpireTimeSpan =
        TimeSpan.FromDays(30);

    options.SlidingExpiration = true;
});



// =====================================
// Services
// =====================================

builder.Services.AddTransient<IEmailSender, MailKitEmailSender>();

builder.Services.AddScoped<IGuardianService, GuardianService>();

builder.Services.AddMemoryCache();



// =====================================
// Forwarded Headers
// For Railway / Render Proxy
// =====================================

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto;


    options.KnownNetworks.Clear();

    options.KnownProxies.Clear();
});



// =====================================
// MVC + Global Authorization
// =====================================

builder.Services.AddControllersWithViews(options =>
{
    var policy =
        new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .Build();


    options.Filters.Add(
        new AuthorizeFilter(policy)
    );
});



// =====================================
// Google Login Optional
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
                options.ClientId =
                    googleClientId;


                options.ClientSecret =
                    googleClientSecret;


                options.SignInScheme =
                    IdentityConstants.ExternalScheme;
            });
}



var app = builder.Build();



// =====================================
// HTTP Pipeline
// =====================================

app.UseForwardedHeaders();



if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler(
        "/Home/Error"
    );


    app.UseHsts();


    app.UseHttpsRedirection();
}



app.UseStaticFiles();


app.UseRouting();



app.UseAuthentication();


app.UseAuthorization();



// =====================================
// Routes
// =====================================

app.MapControllerRoute(
    name: "default",
    pattern:
        "{controller=Home}/{action=Index}/{id?}"
);



app.Run();.AddDefaultTokenProviders()
.AddClaimsPrincipalFactory<AumoUserClaimsPrincipalFactory>();


builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Auth/Login";
    options.AccessDeniedPath = "/Auth/Login";

    options.ExpireTimeSpan = TimeSpan.FromDays(30);

    options.SlidingExpiration = true;
});


// ==========================================================
// 3. Application Services
// ==========================================================

builder.Services.AddTransient<IEmailSender, MailKitEmailSender>();


// Guardian Security Service
// Handles:
// - User sessions
// - Login activity logging
// - Security audit
builder.Services.AddScoped<IGuardianService, GuardianService>();


// Memory Cache
builder.Services.AddMemoryCache();


// ==========================================================
// 4. Forwarded Headers
// ==========================================================

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto;

    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});


// ==========================================================
// 5. MVC + Global Authorization
// ==========================================================

builder.Services.AddControllersWithViews(options =>
{
    var policy =
        new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .Build();

    options.Filters.Add(
        new AuthorizeFilter(policy)
    );
});


// ==========================================================
// 6. Google External Login
// ==========================================================

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
            googleOptions =>
            {
                googleOptions.ClientId = googleClientId;

                googleOptions.ClientSecret = googleClientSecret;

                googleOptions.SignInScheme =
                    IdentityConstants.ExternalScheme;
            });
}


var app = builder.Build();


// ==========================================================
// HTTP Pipeline
// ==========================================================

app.UseForwardedHeaders();


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


// ==========================================================
// Routes
// ==========================================================

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}"
);


app.Run();
