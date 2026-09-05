using System.Text;
using AumoFinance.Controllers.Api;
using AumoFinance.Models;
using AumoFinance.Services;
using AumoFinance.Services.Security;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

// Single File-Scoped Namespace (Wajib diletakkan tepat setelah using)
namespace AumoBackend;

var builder = WebApplication.CreateBuilder(args);

// =====================================
// 1. DATABASE CONFIGURATION (PostgreSQL)
// =====================================
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? Environment.GetEnvironmentVariable("DATABASE_URL");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("Database connection string 'DefaultConnection' or 'DATABASE_URL' is missing.");
}

builder.Services.AddDbContextFactory<AppDbContext>(options =>
{
    options.UseNpgsql(connectionString);
    options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
});

builder.Services.AddScoped<AppDbContext>(sp =>
    sp.GetRequiredService<IDbContextFactory<AppDbContext>>().CreateDbContext());

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
    options.Cookie.Name = "AumoFinance.Session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.None;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromDays(30);
    options.SlidingExpiration = true;

    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});

// =====================================
// 4. AUTHENTICATION (Cookie, JWT & OAuth)
// =====================================
var jwtSigningKey = builder.Configuration["JWT_SIGNING_KEY"]
    ?? Environment.GetEnvironmentVariable("JWT_SIGNING_KEY");

var jwtIssuer = builder.Configuration["JWT_ISSUER"]
    ?? Environment.GetEnvironmentVariable("JWT_ISSUER")
    ?? "AumoFinanceApp";

if (string.IsNullOrWhiteSpace(jwtSigningKey))
{
    throw new InvalidOperationException("Fatal Error: Environment variable 'JWT_SIGNING_KEY' is missing.");
}

var authBuilder = builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = IdentityConstants.ApplicationScheme;
    options.DefaultAuthenticateScheme = IdentityConstants.ApplicationScheme;
    options.DefaultChallengeScheme = IdentityConstants.ApplicationScheme;
})
.AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtIssuer,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey)),
        ClockSkew = TimeSpan.FromMinutes(5)
    };
});

var googleClientId = builder.Configuration["Authentication:Google:ClientId"]
    ?? builder.Configuration["Google:ClientId"]
    ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID");

var googleClientSecret = builder.Configuration["Authentication:Google:ClientSecret"]
    ?? builder.Configuration["Google:ClientSecret"]
    ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_SECRET");

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
// 5. REST API CORE SETUP, SWAGGER & CORS
// =====================================
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "AumoFinance API", Version = "v1" });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter the JWT token in the format: Bearer <your_token>"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL")?.TrimEnd('/');

var originsList = new List<string>
{
    "http://localhost:3000",
    "http://localhost:5000",
    "https://localhost:7000",
    "https://my-authentic-web.vercel.app"
};

if (!string.IsNullOrWhiteSpace(frontendUrl))
{
    originsList.Add(frontendUrl);
}

var allowedOrigins = originsList.Distinct().ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// =====================================
// 6. APPLICATION SERVICES & HEALTH CHECKS
// =====================================
builder.Services.AddHealthChecks();
builder.Services.AddHostedService<RenderKeepAliveService>();

builder.Services.AddTransient<ResendEmailSender>();
builder.Services.AddTransient<IEmailSender<ApplicationUser>, IdentityEmailSenderBridge>();

builder.Services.AddScoped<IGuardianService, GuardianService>();
builder.Services.AddHttpClient<IAiService, AiService>();
builder.Services.AddScoped<IJournalImportService, JournalImportService>();
builder.Services.AddScoped<ITransactionNumberService, TransactionNumberService>();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<ICloudStorageService, CloudinaryService>();
builder.Services.AddScoped<DashboardDataService>();

builder.Services.AddHttpClient("MarketApiClient", client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AumoFinance/1.0");
});

builder.Services.AddScoped<IMarketService, MarketService>();

// =====================================
// 7. FORWARDED HEADERS
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

app.UseSwagger();
app.UseSwaggerUI();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseHsts();
    app.Use(async (context, next) =>
    {
        try
        {
            await next();
        }
        catch (Exception ex)
        {
            var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
            logger.LogError(ex, "Unhandled exception on {Path}", context.Request.Path);

            if (!context.Response.HasStarted)
            {
                context.Response.Clear();
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "A server error occurred. Please try again in a moment."
                });
            }
        }
    });
}

app.UseRouting();

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

// =====================================
// 10. ENDPOINTS & MAP CONTROLLERS
// =====================================
app.MapGet("/", () => Results.Ok(new
{
    service = "AumoFinance Web & Mobile API",
    status = "Online",
    timestamp = DateTime.UtcNow
}));

app.MapHealthChecks("/health");

app.MapPost("/auth/logout", async (SignInManager<ApplicationUser> signInManager) =>
{
    await signInManager.SignOutAsync();
    return Results.Ok(new { success = true, message = "Logout successful" });
});

app.MapControllers();

// =====================================
// 11. RUN APPLICATION
// =====================================
app.Run();

// =====================================
// 12. IDENTITY EMAIL SENDER BRIDGE CLASS
// =====================================
public class IdentityEmailSenderBridge : IEmailSender<ApplicationUser>
{
    private readonly ResendEmailSender _emailSender;

    public IdentityEmailSenderBridge(ResendEmailSender emailSender)
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
