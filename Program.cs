using AumoFinance.Models;
using AumoFinance.Services;
using AumoFinance.Services.Security;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI; // <--- Namespace Microsoft.Extensions.AI
using OpenAI.Chat;             // <--- Namespace resmi OpenAI Chat Client

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
    options.ExpireTimeSpan = TimeSpan.FromDays(30);
    options.SlidingExpiration = true;
});

// =====================================
// Services
// =====================================

builder.Services.AddTransient<IEmailSender, MailKitEmailSender>();
builder.Services.AddScoped<IGuardianService, GuardianService>();
builder.Services.AddScoped<IAiService, AiService>(); 

// =====================================
// Microsoft.Extensions.AI Registration
// =====================================
builder.Services.AddSingleton<IChatClient>(sp =>
{
    var configuration = sp.GetRequiredService<IConfiguration>();
    
    var apiKey = configuration["OpenAI:ApiKey"] 
                 ?? configuration["OPENAI_API_KEY"] 
                 ?? throw new InvalidOperationException("OpenAI API Key is missing in environment variables.");
    
    // Menggunakan AsIChatClient() sesuai package Microsoft.Extensions.AI.OpenAI
    return new OpenAI.Chat.ChatClient(model: "gpt-4o-mini", apiKey: apiKey).AsIChatClient();
});

builder.Services.AddMemoryCache();

// =====================================
// Forwarded Headers (Railway / Render Proxy)
// Updated for .NET 10 (Fix Warning ASPDEPR005)
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
// MVC + Global Authorization + Controllers API
// =====================================

builder.Services.AddControllers();

builder.Services.AddControllersWithViews(options =>
{
    var policy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();

    options.Filters.Add(new AuthorizeFilter(policy));
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
// HTTP Pipeline
// =====================================

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

// =====================================
// Routes Mapping
// =====================================

app.MapControllers(); // Matches [Route("api/ai")] and [Route("api/mobile")]

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}"
);

app.Run();
