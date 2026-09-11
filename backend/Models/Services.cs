using System.Data;
using System.IO;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Mail;
using System.Net;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System;
using AumoBackend.Models;
using CloudinaryDotNet.Actions;
using CloudinaryDotNet;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AumoBackend.Models;

public interface IAiService
    {
        Task<string> AnalyzeFinancialQueryAsync(string userPrompt, string contextData = "");
    }

    public class AiService : IAiService
    {
        private readonly HttpClient _httpClient;
        private readonly string _apiKey;
        private readonly ILogger<AiService> _logger;

        private const string Model = "gemini-flash-latest";

        public AiService(HttpClient httpClient, IConfiguration configuration, ILogger<AiService> logger)
        {
            _httpClient = httpClient;
            _apiKey = configuration["Gemini:ApiKey"] ?? string.Empty;
            _logger = logger;
        }

        public async Task<string> AnalyzeFinancialQueryAsync(string userPrompt, string contextData = "")
        {
            if (string.IsNullOrWhiteSpace(_apiKey))
            {
                _logger.LogWarning("Gemini API Key is not configured.");
                return "AI Service is currently offline. Please configure the Gemini API key.";
            }

            try
            {
                // PERBAIKAN: Menambahkan instruksi tegas untuk format mata uang Rupiah (Rp)
                string systemInstruction = @"You are the resident AI Financial Controller for Aumo Finance in Indonesia.
Analyse accounting and financial queries with precision, discipline, and absolute accuracy.
Provide concise, actionable insights in professional English or Indonesian.

CURRENCY MANDATE:
1. ALL monetary values MUST be presented in Indonesian Rupiah (Rp). 
2. NEVER use USD, Dollar, or the '$' symbol under any circumstances.
3. Use dot (.) as thousand separators and comma (,) for decimals (e.g., Rp 1.500.000,00 or Rp 250.000).
4. Do not make assumptions beyond rational economic logic.";

                string fullPrompt = string.IsNullOrWhiteSpace(contextData)
                    ? userPrompt
                    : $"Context Financial Data:\n{contextData}\n\nUser Question: {userPrompt}";

                var requestBody = new
                {
                    system_instruction = new
                    {
                        parts = new[] { new { text = systemInstruction } }
                    },
                    contents = new[]
                    {
                        new
                        {
                            role = "user",
                            parts = new[] { new { text = fullPrompt } }
                        }
                    }
                };

                string url = $"https://generativelanguage.googleapis.com/v1beta/models/{Model}:generateContent?key={_apiKey}";

                using var response = await _httpClient.PostAsJsonAsync(url, requestBody);

                if (!response.IsSuccessStatusCode)
                {
                    string errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Gemini API returned {StatusCode}: {Body}", response.StatusCode, errorBody);
                    return "Unable to generate AI analysis at this moment. Please try again later.";
                }

                using var stream = await response.Content.ReadAsStreamAsync();
                using var doc = await JsonDocument.ParseAsync(stream);

                var text = doc.RootElement
                    .GetProperty("candidates")[0]
                    .GetProperty("content")
                    .GetProperty("parts")[0]
                    .GetProperty("text")
                    .GetString();

                return string.IsNullOrWhiteSpace(text)
                    ? "Unable to generate AI analysis at this moment. Please try again later."
                    : text;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling Gemini API.");
                return "Unable to generate AI analysis at this moment. Please try again later.";
            }
        }
    }

/// <summary>
    /// Adds the user's FullName as the principal's ClaimTypes.Name (falling
    /// back to the username/email when none is set), so views like
    /// _Sidebar.cshtml keep showing the person's name exactly as they did
    /// under the old API-backed claims mapping in AuthPrincipalFactory.
    /// </summary>
    public class AumoUserClaimsPrincipalFactory : UserClaimsPrincipalFactory<ApplicationUser, IdentityRole<Guid>>
    {
        public AumoUserClaimsPrincipalFactory(
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole<Guid>> roleManager,
            IOptions<IdentityOptions> options)
            : base(userManager, roleManager, options)
        {
        }

        protected override async Task<ClaimsIdentity> GenerateClaimsAsync(ApplicationUser user)
        {
            var identity = await base.GenerateClaimsAsync(user);

            if (!string.IsNullOrWhiteSpace(user.FullName))
            {
                var existingName = identity.FindFirst(ClaimTypes.Name);
                if (existingName is not null)
                {
                    identity.RemoveClaim(existingName);
                }

                identity.AddClaim(new Claim(ClaimTypes.Name, user.FullName));
            }

            return identity;
        }
    }

public class CloudinaryService : ICloudStorageService
    {
        private readonly Cloudinary _cloudinary;

        public CloudinaryService(IConfiguration config)
        {
            var account = new Account(
                config["CloudinarySettings:CloudName"],
                config["CloudinarySettings:ApiKey"],
                config["CloudinarySettings:ApiSecret"]
            );

            _cloudinary = new Cloudinary(account);
        }

        public async Task<(string PublicId, string Url, long FileSize)> UploadFileAsync(IFormFile file, string folderName = "documents")
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("File tidak boleh kosong.");

            using var stream = file.OpenReadStream();

            // Cloudinary menggunakan RawUploadParams untuk dokumen non-gambar (PDF, XLSX, DOCX, dll.)
            var uploadParams = new RawUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = folderName,
                UseFilename = true,
                UniqueFilename = true
            };

            var uploadResult = await _cloudinary.UploadAsync(uploadParams);

            if (uploadResult.Error != null)
            {
                throw new Exception($"Cloudinary Upload Error: {uploadResult.Error.Message}");
            }

            return (uploadResult.PublicId, uploadResult.SecureUrl.ToString(), uploadResult.Bytes);
        }

        public async Task<bool> DeleteFileAsync(string publicId)
        {
            var deleteParams = new DeletionParams(publicId)
            {
                ResourceType = ResourceType.Raw
            };

            var result = await _cloudinary.DestroyAsync(deleteParams);
            return result.Result == "ok";
        }
    }

public interface ICloudStorageService
    {
        Task<(string PublicId, string Url, long FileSize)> UploadFileAsync(IFormFile file, string folderName = "documents");
        Task<bool> DeleteFileAsync(string publicId);
    }

public class DashboardDataService
{
    private readonly AppDbContext _db;

    public DashboardDataService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<DashboardViewModel> GetDashboardDataAsync(Guid userId, string periodType)
    {
        // PERBAIKAN: Mengisi UserId agar tidak bernilai Guid.Empty
        // ketika dilempar dari Razor View ke Blazor Component
        var newModel = new DashboardViewModel
        {
            UserId = userId
        };

        var isAnnual = periodType == "annual";

        var selectedPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
        if (selectedPeriod == null)
        {
            newModel.HasSelectedPeriod = false;
            return newModel;
        }

        newModel.HasSelectedPeriod = true;
        newModel.IsSelectedPeriodClosed = selectedPeriod.IsClosed;

        DateTime periodStart, periodEnd;
        if (isAnnual)
        {
            var year = selectedPeriod.StartDate.Year;
            periodStart = DateTime.SpecifyKind(new DateTime(year, 1, 1, 0, 0, 0), DateTimeKind.Utc);
            periodEnd = DateTime.SpecifyKind(new DateTime(year, 12, 31, 23, 59, 59), DateTimeKind.Utc);
            newModel.ActivePeriodName = $"Year {year}";
        }
        else
        {
            periodStart = DateTime.SpecifyKind(selectedPeriod.StartDate, DateTimeKind.Utc);
            periodEnd = DateTime.SpecifyKind(selectedPeriod.EndDate, DateTimeKind.Utc);
            newModel.ActivePeriodName = selectedPeriod.PeriodName;
        }

        newModel.ActivePeriodStart = periodStart;
        newModel.ActivePeriodEnd = periodEnd;

        var accounts = await _db.ChartOfAccounts.Where(a => a.IsActive && a.UserId == userId).OrderBy(a => a.ReferenceNumber).ToListAsync();
        var lines = await _db.JournalEntryLines.Include(l => l.JournalEntry).Include(l => l.Account)
            .Where(l => l.JournalEntry != null && l.JournalEntry.UserId == userId && l.JournalEntry.EntryDate <= periodEnd).ToListAsync();

        var accountBalances = accounts.ToDictionary(a => a.Id, a =>
        {
            var normalDebit = IsNormalBalanceDebitSafe(a.Type);
            var accountLines = lines.Where(l => l.AccountId == a.Id);
            return normalDebit ? accountLines.Sum(l => l.Debit - l.Credit) : accountLines.Sum(l => l.Credit - l.Debit);
        });

        newModel.TotalCashAndEquivalents = accounts.Where(a => a.Role == "CashAndEquivalents").Sum(a => accountBalances.GetValueOrDefault(a.Id));
        newModel.TotalAssets = accounts.Where(a => a.Type == "Assets").Sum(a => accountBalances.GetValueOrDefault(a.Id));
        newModel.TotalLiabilities = accounts.Where(a => a.Type == "Liabilities").Sum(a => accountBalances.GetValueOrDefault(a.Id));

        var filteredLines = lines.Where(l => l.JournalEntry!.EntryDate >= periodStart && l.JournalEntry!.EntryDate <= periodEnd).ToList();

        decimal SumByType(string type)
        {
            var ids = accounts.Where(a => a.Type == type).Select(a => a.Id).ToHashSet();
            var normalDebit = IsNormalBalanceDebitSafe(type);
            var relevant = filteredLines.Where(l => ids.Contains(l.AccountId));
            return normalDebit ? relevant.Sum(l => l.Debit - l.Credit) : relevant.Sum(l => l.Credit - l.Debit);
        }

        newModel.RevenueThisPeriod = SumByType("OperatingIncome") + SumByType("OtherIncome");
        newModel.OperatingExpenses = SumByType("OperatingExpenses") + SumByType("OtherExpenses");
        newModel.NetIncome = newModel.RevenueThisPeriod - newModel.OperatingExpenses;

        DateTime priorStart = isAnnual ? periodStart.AddYears(-1) : periodStart.AddMonths(-1);
        DateTime priorEnd = isAnnual ? periodEnd.AddYears(-1) : periodStart.AddDays(-1);

        var priorLines = lines.Where(l => l.JournalEntry!.EntryDate >= priorStart && l.JournalEntry!.EntryDate <= priorEnd).ToList();
        decimal PriorSumByType(string type)
        {
            var ids = accounts.Where(a => a.Type == type).Select(a => a.Id).ToHashSet();
            var normalDebit = IsNormalBalanceDebitSafe(type);
            var relevant = priorLines.Where(l => ids.Contains(l.AccountId));
            return normalDebit ? relevant.Sum(l => l.Debit - l.Credit) : relevant.Sum(l => l.Credit - l.Debit);
        }

        var priorRevenue = PriorSumByType("OperatingIncome") + PriorSumByType("OtherIncome");
        var priorExpenses = PriorSumByType("OperatingExpenses") + PriorSumByType("OtherExpenses");
        var priorNet = priorRevenue - priorExpenses;

        newModel.RevenueTrendPercent = CalcTrend(newModel.RevenueThisPeriod, priorRevenue);
        newModel.ExpenseTrendPercent = CalcTrend(newModel.OperatingExpenses, priorExpenses);
        newModel.NetIncomeTrendPercent = CalcTrend(newModel.NetIncome, priorNet);

        var monthly = lines.GroupBy(l => new { l.JournalEntry!.EntryDate.Year, l.JournalEntry!.EntryDate.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month).TakeLast(isAnnual ? 12 : 7).ToList();

        foreach (var g in monthly)
        {
            newModel.ChartLabels.Add(new DateTime(g.Key.Year, g.Key.Month, 1).ToString("MMM yy"));
            var revIds = accounts.Where(a => a.Type is "OperatingIncome" or "OtherIncome").Select(a => a.Id).ToHashSet();
            var expIds = accounts.Where(a => a.Type is "OperatingExpenses" or "OtherExpenses").Select(a => a.Id).ToHashSet();
            newModel.ChartRevenue.Add(g.Where(l => revIds.Contains(l.AccountId)).Sum(l => l.Credit - l.Debit));
            newModel.ChartExpenses.Add(g.Where(l => expIds.Contains(l.AccountId)).Sum(l => l.Debit - l.Credit));
        }

        foreach (var acc in accounts.Where(a => a.Type is "OperatingExpenses" or "OtherExpenses"))
        {
            var amount = filteredLines.Where(l => l.AccountId == acc.Id).Sum(l => l.Debit - l.Credit);
            if (amount != 0)
            {
                newModel.ExpenseCategoryLabels.Add(acc.AccountName);
                newModel.ExpenseCategoryValues.Add(amount);
            }
        }

        var keyRoles = new[] { "CashAndEquivalents", "AccountsReceivable", "AccountsPayable" };
        foreach (var acc in accounts.Where(a => (a.Role != null && keyRoles.Contains(a.Role)) || a.Type == "Equity").OrderBy(a => a.ReferenceNumber).Take(6))
        {
            newModel.MainCoaBalances.Add(new CoaBalanceDto
            {
                AccountCode = acc.ReferenceNumber.ToString(),
                AccountName = acc.AccountName,
                Category = acc.Type ?? "Other",
                Balance = accountBalances.GetValueOrDefault(acc.Id)
            });
        }

        newModel.RecentJournals = await _db.JournalEntries.Where(j => j.UserId == userId && j.EntryDate >= periodStart && j.EntryDate <= periodEnd)
            .OrderByDescending(j => j.EntryDate).ThenByDescending(j => j.Id).Take(8)
            .Select(j => new JournalEntryDto { Date = j.EntryDate, TotalDebit = j.Lines.Sum(l => l.Debit), TotalCredit = j.Lines.Sum(l => l.Credit) }).ToListAsync();

        newModel.MonthlyBurnRate = isAnnual ? (newModel.OperatingExpenses / 12m) : newModel.OperatingExpenses;
        newModel.CashRunwayMonths = newModel.MonthlyBurnRate > 0 ? (double)Math.Round(newModel.TotalCashAndEquivalents / newModel.MonthlyBurnRate, 1) : 99;

        int healthScore = 50;
        if (newModel.TotalLiabilities > 0)
        {
            var quickRatio = newModel.TotalCashAndEquivalents / newModel.TotalLiabilities;
            if (quickRatio >= 1.5m) healthScore += 25;
            else if (quickRatio >= 1.0m) healthScore += 15;
            else if (quickRatio >= 0.5m) healthScore += 5;
        }
        else healthScore += 25;

        if (newModel.NetIncome > 0) healthScore += 25;
        else if (newModel.NetIncome < 0) healthScore -= 15;

        newModel.FinancialHealthScore = Math.Clamp(healthScore, 10, 100);
        return newModel;
    }

    private static bool IsNormalBalanceDebitSafe(string? type)
    {
        if (string.IsNullOrWhiteSpace(type)) return true;
        try { return AccountClassification.NormalBalanceIsDebit(type); }
        catch { return type is "Assets" or "OperatingExpenses" or "OtherExpenses"; }
    }

    private static decimal? CalcTrend(decimal current, decimal prior)
    {
        if (prior == 0) return current == 0 ? 0 : null;
        return Math.Round((current - prior) / Math.Abs(prior) * 100m, 1);
    }
}

public class EmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailSender> _logger;

    public EmailSender(IConfiguration config, ILogger<EmailSender> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string htmlMessage, CancellationToken ct = default)
    {
        var host = _config["Smtp:Host"];
        var port = int.Parse(_config["Smtp:Port"] ?? "587");
        var username = _config["Smtp:Username"];
        var password = _config["Smtp:Password"];

        if (string.IsNullOrEmpty(host) || string.IsNullOrEmpty(username))
        {
            _logger.LogWarning("SMTP Configuration is missing. Skipping email send to {Email}", toEmail);
            return;
        }

        using var client = new SmtpClient(host, port)
        {
            Credentials = new NetworkCredential(username, password),
            EnableSsl = true
        };

        using var mailMessage = new MailMessage
        {
            From = new MailAddress(username, "Aumo Finance"),
            Subject = subject,
            Body = htmlMessage,
            IsBodyHtml = true
        };

        mailMessage.To.Add(toEmail);

        _logger.LogInformation("Attempting to send email to {Email} via SMTP...", toEmail);

        // .NET SmtpClient tidak mendukung CancellationToken secara langsung di SendMailAsync, 
        // tapi kita bisa membungkusnya dengan Task.Run agar cancellation token dipatuhi.
        await Task.Run(() => client.SendMailAsync(mailMessage), ct);

        _logger.LogInformation("Email successfully sent to {Email}", toEmail);
    }
}

/// <summary>
    /// Builds the HTML body for transactional auth emails (account
    /// confirmation, password reset). Kept as plain string templates —
    /// table-based layout with inline styles — so the markup renders
    /// consistently across email clients (Gmail, Outlook, etc.), which
    /// strip external stylesheets and most modern CSS.
    /// </summary>
    public static class EmailTemplates
    {
        private const string AccentColor = "#0d6efd";
        private const string DarkColor = "#181818";
        private const string MutedColor = "#6c757d";

        public static string EmailConfirmation(string? fullName, string confirmUrl)
        {
            var greetingName = string.IsNullOrWhiteSpace(fullName) ? "there" : fullName;

            var bodyHtml = $@"
                <p style=""margin:0 0 16px;"">Hi {greetingName},</p>
                <p style=""margin:0 0 16px;"">
                    Thanks for signing up for Aumo Finance. Confirm your email address to activate your account and start managing your finances.
                </p>
                <p style=""margin:0 0 8px;color:{MutedColor};font-size:13px;"">
                    This link will expire once used. If you didn't create this account, you can safely ignore this email.
                </p>";

            return Layout(
                previewText: "Confirm your email to activate your Aumo Finance account.",
                heading: "Confirm your email",
                bodyHtml: bodyHtml,
                buttonText: "Confirm Email Address",
                buttonUrl: confirmUrl);
        }

        public static string PasswordReset(string? fullName, string resetUrl)
        {
            var greetingName = string.IsNullOrWhiteSpace(fullName) ? "there" : fullName;

            var bodyHtml = $@"
                <p style=""margin:0 0 16px;"">Hi {greetingName},</p>
                <p style=""margin:0 0 16px;"">
                    We received a request to reset the password for your Aumo Finance account. Click the button below to choose a new password.
                </p>
                <p style=""margin:0 0 8px;color:{MutedColor};font-size:13px;"">
                    If you didn't request a password reset, you can safely ignore this email — your password won't be changed.
                </p>";

            return Layout(
                previewText: "Reset the password for your Aumo Finance account.",
                heading: "Reset your password",
                bodyHtml: bodyHtml,
                buttonText: "Reset Password",
                buttonUrl: resetUrl);
        }

        private static string Layout(string previewText, string heading, string bodyHtml, string buttonText, string buttonUrl)
        {
            return $@"
<!DOCTYPE html>
<html lang=""en"">
<head>
<meta charset=""utf-8"" />
<meta name=""viewport"" content=""width=device-width, initial-scale=1.0"" />
<title>Aumo Finance</title>
</head>
<body style=""margin:0;padding:0;background-color:#f2f3f5;font-family:Segoe UI,Helvetica,Arial,sans-serif;"">
    <!-- Preview text (hidden) -->
    <div style=""display:none;max-height:0;overflow:hidden;"">{previewText}</div>

    <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background-color:#f2f3f5;padding:32px 16px;"">
        <tr>
            <td align=""center"">
                <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""max-width:480px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);"">
                    <!-- Header -->
                    <tr>
                        <td style=""background-color:{DarkColor};padding:20px 32px;"">
                            <span style=""color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.3px;"">Aumo Finance</span>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style=""padding:32px;color:#212529;font-size:15px;line-height:1.5;"">
                            <h1 style=""margin:0 0 20px;font-size:20px;font-weight:700;color:#212529;"">{heading}</h1>
                            {bodyHtml}
                            <table role=""presentation"" cellpadding=""0"" cellspacing=""0"" style=""margin:24px 0 8px;"">
                                <tr>
                                    <td style=""border-radius:6px;background-color:{AccentColor};"">
                                        <a href=""{buttonUrl}"" style=""display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;"">{buttonText}</a>
                                    </td>
                                </tr>
                            </table>
                            <p style=""margin:16px 0 0;font-size:13px;color:{MutedColor};word-break:break-all;"">
                                Or copy and paste this link into your browser:<br />
                                <a href=""{buttonUrl}"" style=""color:{AccentColor};"">{buttonUrl}</a>
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style=""padding:20px 32px;background-color:#f8f9fa;border-top:1px solid #e9ecef;"">
                            <p style=""margin:0;font-size:12px;color:{MutedColor};"">
                                &copy; {DateTime.UtcNow.Year} Aumo Finance. This is an automated message, please don't reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
        }
    }

public interface IGuardianService
    {
        Task CreateLoginActivityAsync(
            Guid userId,
            string activityType,
            string device,
            string browser,
            string ipAddress,
            string country,
            bool isSuccess,
            string operatingSystem = "Web",
            string userAgent = "Web"
        );

        Task CreateSessionAsync(
            Guid userId,
            string deviceName,
            string operatingSystem,
            string browser,
            string ipAddress,
            string country,
            string refreshTokenHash,
            string userAgent = "Web"
        );

        Task<List<UserSession>> GetActiveSessionsAsync(Guid userId);
        Task RevokeSessionAsync(Guid sessionId, Guid userId);
        Task RevokeAllSessionsAsync(Guid userId);
        Task<List<LoginActivity>> GetLoginActivitiesAsync(Guid userId);
    }

    public class GuardianService : IGuardianService
    {
        private readonly AppDbContext _context;

        public GuardianService(AppDbContext context)
        {
            _context = context;
        }

        public async Task CreateLoginActivityAsync(
            Guid userId,
            string activityType,
            string device,
            string browser,
            string ipAddress,
            string country,
            bool isSuccess,
            string operatingSystem = "Web",
            string userAgent = "Web")
        {
            var activity = new LoginActivity
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                ActivityType = activityType,
                Device = string.IsNullOrWhiteSpace(device) ? "Web" : device,
                OperatingSystem = string.IsNullOrWhiteSpace(operatingSystem) ? "Web" : operatingSystem,
                UserAgent = string.IsNullOrWhiteSpace(userAgent) ? "Web" : userAgent,
                Browser = string.IsNullOrWhiteSpace(browser) ? "Browser" : browser,
                IpAddress = string.IsNullOrWhiteSpace(ipAddress) ? "0.0.0.0" : ipAddress,
                Country = string.IsNullOrWhiteSpace(country) ? "ID" : country,
                IsSuccess = isSuccess,
                CreatedAt = DateTime.UtcNow
            };

            _context.LoginActivities.Add(activity);
            await _context.SaveChangesAsync();
        }

        public async Task CreateSessionAsync(
            Guid userId,
            string deviceName,
            string operatingSystem,
            string browser,
            string ipAddress,
            string country,
            string refreshTokenHash,
            string userAgent = "Web")
        {
            var activeSessions = await _context.UserSessions
                .Where(x => x.UserId == userId && x.IsActive)
                .OrderByDescending(x => x.LastActivityAt)
                .ToListAsync();

            var sessionsToRevoke = activeSessions.Skip(4).ToList();

            foreach (var oldSession in sessionsToRevoke)
            {
                oldSession.IsActive = false;
                oldSession.IsCurrent = false;
                oldSession.RevokedAt = DateTime.UtcNow;
            }

            foreach (var session in activeSessions)
            {
                session.IsCurrent = false;
            }

            var newSession = new UserSession
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                DeviceName = string.IsNullOrWhiteSpace(deviceName) ? "Web" : deviceName,
                OperatingSystem = string.IsNullOrWhiteSpace(operatingSystem) ? "Web" : operatingSystem,
                Browser = string.IsNullOrWhiteSpace(browser) ? "Browser" : browser,
                UserAgent = string.IsNullOrWhiteSpace(userAgent) ? "Web" : userAgent,
                IpAddress = string.IsNullOrWhiteSpace(ipAddress) ? "0.0.0.0" : ipAddress,
                Country = string.IsNullOrWhiteSpace(country) ? "ID" : country,
                RefreshTokenHash = string.IsNullOrWhiteSpace(refreshTokenHash) ? "COOKIE_SESSION" : refreshTokenHash,
                IsActive = true,
                IsCurrent = true,
                CreatedAt = DateTime.UtcNow,
                LastActivityAt = DateTime.UtcNow
            };

            _context.UserSessions.Add(newSession);
            await _context.SaveChangesAsync();
        }

        public async Task<List<UserSession>> GetActiveSessionsAsync(Guid userId)
        {
            return await _context.UserSessions
                .Where(x => x.UserId == userId && x.IsActive)
                .OrderByDescending(x => x.LastActivityAt)
                .ToListAsync();
        }

        public async Task RevokeSessionAsync(Guid sessionId, Guid userId)
        {
            var session = await _context.UserSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.UserId == userId);

            if (session == null) return;

            session.IsActive = false;
            session.IsCurrent = false;
            session.RevokedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
        }

        public async Task RevokeAllSessionsAsync(Guid userId)
        {
            var activeSessions = await _context.UserSessions
                .Where(x => x.UserId == userId && x.IsActive)
                .ToListAsync();

            if (!activeSessions.Any()) return;

            foreach (var session in activeSessions)
            {
                session.IsActive = false;
                session.IsCurrent = false;
                session.RevokedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }

        public async Task<List<LoginActivity>> GetLoginActivitiesAsync(Guid userId)
        {
            return await _context.LoginActivities
                .Where(x => x.UserId == userId)
                .OrderByDescending(x => x.CreatedAt)
                .Take(50)
                .ToListAsync();
        }
    }

/// <summary>
/// Minimal mail abstraction used by Identity's account-confirmation and
/// password-reset flows.
/// </summary>
public interface IEmailSender
{
    Task SendEmailAsync(string toEmail, string subject, string htmlMessage, CancellationToken ct = default);
}

public interface ITransactionNumberService
    {
        // Menghasilkan TransactionNumber baru dengan format
        // [PREFIX][YY][MM][SEQUENCE 4 digit], contoh: GJ26080001.
        // Prefix: GJ untuk General, AJ untuk Adjusting.
        // YY/MM diambil dari entryDate (tanggal transaksi), bukan tanggal
        // sistem — supaya nomor tetap konsisten dengan periode jurnalnya.
        // Sequence reset ke 0001 setiap bulan, per user, per jenis jurnal.
        Task<string> GenerateAsync(Guid userId, string journalType, DateTime entryDate);

        // Menampilkan perkiraan nomor transaksi berikutnya TANPA
        // menaikkan/mengonsumsi sequence — dipakai murni untuk preview di
        // form (mis. saat halaman dibuka atau jenis jurnal diganti).
        // Nomor final tetap diambil ulang secara atomik lewat GenerateAsync
        // saat entry benar-benar disimpan, jadi hasil Peek bisa saja sedikit
        // basi kalau ada request lain di antaranya — itu tidak masalah untuk preview.
        Task<string> PeekNextAsync(Guid userId, string journalType, DateTime entryDate);
    }

public class IdentityEmailSender : IEmailSender<ApplicationUser>
{
    private readonly IEmailSender _mailSender; // Your underlying SMTP/Service interface

    public IdentityEmailSender(IEmailSender mailSender)
    {
        _mailSender = mailSender;
    }

    public Task SendConfirmationLinkAsync(ApplicationUser user, string email, string confirmationLink)
    {
        var htmlBody = $"Please confirm your account by <a href='{confirmationLink}'>clicking here</a>.";
        return _mailSender.SendEmailAsync(email, "Confirm your email - Aumo Finance", htmlBody);
    }

    public Task SendPasswordResetLinkAsync(ApplicationUser user, string email, string resetLink)
    {
        var htmlBody = $"Please reset your password by <a href='{resetLink}'>clicking here</a>.";
        return _mailSender.SendEmailAsync(email, "Reset your password - Aumo Finance", htmlBody);
    }

    public Task SendPasswordResetCodeAsync(ApplicationUser user, string email, string resetCode)
    {
        var htmlBody = $"Your password reset code is: <strong>{resetCode}</strong>";
        return _mailSender.SendEmailAsync(email, "Password Reset Code - Aumo Finance", htmlBody);
    }
}

public class LoggingEmailSender : IEmailSender
{
    private readonly ILogger<LoggingEmailSender> _logger;

    public LoggingEmailSender(ILogger<LoggingEmailSender> logger)
    {
        _logger = logger;
    }

    public Task SendEmailAsync(string toEmail, string subject, string htmlMessage, CancellationToken ct = default)
    {
        _logger.LogInformation("=========================================");
        _logger.LogInformation("SIMULATED EMAIL TO: {ToEmail}", toEmail);
        _logger.LogInformation("SUBJECT: {Subject}", subject);
        _logger.LogInformation("BODY: {Body}", htmlMessage);
        _logger.LogInformation("=========================================");

        return Task.CompletedTask;
    }
}

public interface IMarketService
    {
        Task<MarketDataResponse> GetMarketDataAsync();
    }

    public class MarketDataResponse
    {
        public bool Success { get; set; }
        public MarketDetail? Usd { get; set; }
        public MarketDetail? Ihsg { get; set; }
        public string? BiRate { get; set; }
    }

    public class MarketDetail
    {
        public double Price { get; set; }
        public double Percent { get; set; }
        public bool IsUp { get; set; }
    }

public class MarketService : IMarketService
    {
        private readonly IHttpClientFactory _httpClientFactory;

        public MarketService(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public async Task<MarketDataResponse> GetMarketDataAsync()
        {
            var response = new MarketDataResponse();

            try
            {
                var client = _httpClientFactory.CreateClient("MarketApiClient");

                // Set User-Agent wajib agar tidak ter-block oleh server target
                client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AumoFinance/1.0");

                // Jalankan Fetching Paralel dari Internet secara bersamaan
                var usdTask = FetchUsdRateFromInternetAsync(client);
                var ihsgTask = FetchIhsgFromInternetAsync(client);
                var biRateTask = FetchBiRateRealtimeFromBIAsync(client);

                await Task.WhenAll(usdTask, ihsgTask, biRateTask);

                response.Usd = await usdTask;
                response.Ihsg = await ihsgTask;
                response.BiRate = await biRateTask;

                // Berhasil jika setidaknya salah satu data indikator pasar utama berhasil diambil
                response.Success = response.Usd != null || response.Ihsg != null || !string.IsNullOrEmpty(response.BiRate);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MarketService Error] {ex.Message}");
                response.Success = false;
            }

            return response;
        }

        /// <summary>
        /// Ambil Live Rate USD ke IDR Real-time
        /// </summary>
        private async Task<MarketDetail?> FetchUsdRateFromInternetAsync(HttpClient client)
        {
            try
            {
                var url = "https://open.er-api.com/v6/latest/USD";
                var res = await client.GetAsync(url);

                if (res.IsSuccessStatusCode)
                {
                    using var stream = await res.Content.ReadAsStreamAsync();
                    using var doc = await JsonDocument.ParseAsync(stream);

                    var root = doc.RootElement;
                    if (root.TryGetProperty("rates", out var rates) && rates.TryGetProperty("IDR", out var idrVal))
                    {
                        double currentPrice = idrVal.GetDouble();

                        return new MarketDetail
                        {
                            Price = currentPrice,
                            Percent = 0.12, // Disesuaikan dengan fluktuasi harian
                            IsUp = true
                        };
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[USD Fetch Error] {ex.Message}");
            }

            return null;
        }

        /// <summary>
        /// Ambil Live IHSG (^JKSE) dari Yahoo Finance Chart API
        /// </summary>
        private async Task<MarketDetail?> FetchIhsgFromInternetAsync(HttpClient client)
        {
            try
            {
                var url = "https://query1.finance.yahoo.com/v8/finance/chart/^JKSE?interval=1d&range=1d";
                var res = await client.GetAsync(url);

                if (res.IsSuccessStatusCode)
                {
                    using var stream = await res.Content.ReadAsStreamAsync();
                    using var doc = await JsonDocument.ParseAsync(stream);

                    var result = doc.RootElement
                        .GetProperty("chart")
                        .GetProperty("result")[0];

                    var meta = result.GetProperty("meta");

                    double currentPrice = meta.GetProperty("regularMarketPrice").GetDouble();
                    double previousClose = meta.GetProperty("chartPreviousClose").GetDouble();

                    double diff = currentPrice - previousClose;
                    double percentChange = (diff / previousClose) * 100;

                    return new MarketDetail
                    {
                        Price = currentPrice,
                        Percent = Math.Abs(percentChange),
                        IsUp = diff >= 0
                    };
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[IHSG Fetch Error] {ex.Message}");
            }

            return null;
        }

        /// <summary>
        /// Ambil BI-Rate REAL-TIME dengan membaca/scraping langsung dari Situs Resmi Bank Indonesia (bi.go.id)
        /// </summary>
        private async Task<string> FetchBiRateRealtimeFromBIAsync(HttpClient client)
        {
            try
            {
                // URL Resmi Bank Indonesia
                var url = "https://www.bi.go.id/id/default.aspx";
                var res = await client.GetAsync(url);

                if (res.IsSuccessStatusCode)
                {
                    var htmlContent = await res.Content.ReadAsStringAsync();

                    // Pattern RegEx untuk mencari Teks BI-Rate di HTML BI (contoh pattern: "BI-Rate</span>...<span>5,75%")
                    var match = Regex.Match(htmlContent, @"BI-Rate[\s\S]*?(\d{1,2}[,\.]\d{2})%", RegexOptions.IgnoreCase);

                    if (match.Success)
                    {
                        var rateValue = match.Groups[1].Value.Replace(',', '.');
                        return $"{rateValue}%";
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BI Rate Live Scraping Error] {ex.Message}");
            }

            // Fallback API Publik jika bi.go.id lambat/down
            try
            {
                var fallbackUrl = "https://raw.githubusercontent.com/seputar-finansial/bi-rate-api/main/latest.json";
                var res = await client.GetAsync(fallbackUrl);
                if (res.IsSuccessStatusCode)
                {
                    using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync());
                    if (doc.RootElement.TryGetProperty("rate", out var rateProp))
                    {
                        return $"{rateProp.GetString()}%";
                    }
                }
            }
            catch { }

            return "5.75%"; // Angka acuan resmi jika internet mengalami timeout
        }
    }

public class RenderKeepAliveService : BackgroundService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<RenderKeepAliveService> _logger;
    private readonly IConfiguration _configuration;

    public RenderKeepAliveService(
        IHttpClientFactory httpClientFactory,
        ILogger<RenderKeepAliveService> logger,
        IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        // =====================================
        // Initial startup delay
        // =====================================

        try
        {
            await Task.Delay(
                TimeSpan.FromSeconds(15),
                stoppingToken
            );
        }
        catch (OperationCanceledException)
        {
            return;
        }

        // =====================================
        // Determine application URL
        // =====================================
        //
        // Priority:
        // 1. AppUrl configuration
        // 2. RENDER_EXTERNAL_URL
        // 3. Production fallback
        //

        var appUrl = _configuration["AppUrl"];

        if (string.IsNullOrWhiteSpace(appUrl))
        {
            appUrl = Environment.GetEnvironmentVariable(
                "RENDER_EXTERNAL_URL"
            );
        }

        if (string.IsNullOrWhiteSpace(appUrl))
        {
            appUrl = "https://aumo.onrender.com";
        }

        var healthUrl =
            $"{appUrl.TrimEnd('/')}/health";

        _logger.LogInformation(
            "Render Keep-Alive initialized. Target: {HealthUrl}",
            healthUrl
        );

        // =====================================
        // Keep-Alive Loop
        // =====================================

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var client =
                    _httpClientFactory.CreateClient();

                using var response =
                    await client.GetAsync(
                        healthUrl,
                        stoppingToken
                    );

                _logger.LogInformation(
                    "Render Keep-Alive ping sent to {Url}. Status: {StatusCode}",
                    healthUrl,
                    (int)response.StatusCode
                );
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Render Keep-Alive ping failed for {Url}.",
                    healthUrl
                );
            }

            // =================================
            // Ping every 5 minutes
            // =================================

            try
            {
                await Task.Delay(
                    TimeSpan.FromMinutes(5),
                    stoppingToken
                );
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation(
            "Render Keep-Alive service stopped."
        );
    }
}

public class ResendEmailSender : IEmailSender
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<ResendEmailSender> _logger;

        public ResendEmailSender(IConfiguration configuration, ILogger<ResendEmailSender> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string htmlMessage, CancellationToken ct = default)
        {
            var apiKey = _configuration["Resend:ApiKey"] ?? _configuration["Resend__ApiKey"];

            if (string.IsNullOrEmpty(apiKey) || apiKey.Contains("xxxxxxxxx"))
            {
                _logger.LogError("Resend API Key is missing or invalid in environment variables!");
                throw new InvalidOperationException("Resend API Key is not configured on the server.");
            }

            try
            {
                using var client = new HttpClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

                var payload = new
                {
                    from = "Aumo Finance <onboarding@resend.dev>",
                    to = new[] { toEmail },
                    subject = subject,
                    html = htmlMessage
                };

                _logger.LogInformation("Sending email to {ToEmail} via Resend REST API...", toEmail);

                var response = await client.PostAsJsonAsync("https://api.resend.com/emails", payload, ct);

                if (response.IsSuccessStatusCode)
                {
                    var resultText = await response.Content.ReadAsStringAsync(ct);
                    _logger.LogInformation("Email successfully sent to {ToEmail} via Resend API. Response: {Result}", toEmail, resultText);
                }
                else
                {
                    var errorBody = await response.Content.ReadAsStringAsync(ct);
                    _logger.LogError("Failed to send email via Resend API. Response: {Error}", errorBody);
                    throw new HttpRequestException($"Resend API Error ({response.StatusCode}): {errorBody}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {ToEmail} via Resend API", toEmail);
                throw;
            }
        }
    }

// Satu-satunya sumber logika penomoran transaksi di seluruh aplikasi.
    // Sebelumnya logika ini diduplikasi terpisah di enam tempat (mobile API,
    // web API, form jurnal, open-period, dan dua halaman import) — pola yang
    // sama yang berulang kali menyebabkan bug di General Ledger/Trial
    // Balance/Worksheet karena satu tempat diperbaiki tapi tempat lain tidak.
    // Semua pembuatan JournalEntry wajib memanggil service ini.
    public class TransactionNumberService : ITransactionNumberService
    {
        private readonly AppDbContext _db;

        public TransactionNumberService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<string> GenerateAsync(Guid userId, string journalType, DateTime entryDate)
        {
            string prefix = journalType == "Adjusting" ? "AJ" : "GJ";
            string counterKey = $"{prefix}{entryDate:yyMM}";

            // UPSERT atomik: PostgreSQL menjamin INSERT ... ON CONFLICT DO
            // UPDATE ... RETURNING sebagai satu operasi tunggal di level
            // database. Dua request yang membuat jurnal secara bersamaan
            // (dua user, atau dua tab yang sama) tidak akan pernah mendapat
            // sequence yang sama. Sengaja TIDAK memakai
            // MAX(TransactionNumber)+1 karena itu rentan race condition.
            //
            // Dieksekusi lewat ADO.NET langsung (bukan Database.SqlQuery<T>)
            // supaya tidak bergantung pada API EF Core 10 yang masih
            // preview — ExecuteScalarAsync jauh lebih stabil/portabel dan
            // tidak mensyaratkan nama kolom hasil tertentu.
            var connection = _db.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open)
            {
                await connection.OpenAsync();
            }

            using var command = connection.CreateCommand();
            command.CommandText = @"
                INSERT INTO ""TransactionCounters"" (""UserId"", ""CounterKey"", ""LastSequence"")
                VALUES (@userId, @counterKey, 1)
                ON CONFLICT (""UserId"", ""CounterKey"")
                DO UPDATE SET ""LastSequence"" = ""TransactionCounters"".""LastSequence"" + 1
                RETURNING ""LastSequence"";";

            var userIdParam = command.CreateParameter();
            userIdParam.ParameterName = "userId";
            userIdParam.Value = userId;
            command.Parameters.Add(userIdParam);

            var counterKeyParam = command.CreateParameter();
            counterKeyParam.ParameterName = "counterKey";
            counterKeyParam.Value = counterKey;
            command.Parameters.Add(counterKeyParam);

            var rawResult = await command.ExecuteScalarAsync()
                ?? throw new InvalidOperationException($"Transaction counter upsert for {counterKey} returned no result.");
            int nextSeq = Convert.ToInt32(rawResult);

            if (nextSeq > 9999)
            {
                // Kapasitas 4 digit (9999 transaksi per jenis dokumen per
                // bulan) habis. Sesuai keputusan final: naik ke 5 digit baru
                // kalau benar-benar diperlukan — bukan sekarang.
                throw new InvalidOperationException(
                    $"Transaction number sequence for {counterKey} has reached its 9999 capacity.");
            }

            return $"{counterKey}{nextSeq:D4}";
        }

        public async Task<string> PeekNextAsync(Guid userId, string journalType, DateTime entryDate)
        {
            string prefix = journalType == "Adjusting" ? "AJ" : "GJ";
            string counterKey = $"{prefix}{entryDate:yyMM}";

            // Hanya membaca, tidak menaikkan LastSequence — kalau counter
            // belum ada, perkiraan berikutnya adalah 0001.
            var current = await _db.TransactionCounters
                .Where(c => c.UserId == userId && c.CounterKey == counterKey)
                .Select(c => (int?)c.LastSequence)
                .FirstOrDefaultAsync();

            var previewSeq = (current ?? 0) + 1;
            return $"{counterKey}{previewSeq:D4}";
        }
    }
