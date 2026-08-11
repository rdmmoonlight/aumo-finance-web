using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Resend;

namespace AumoFinance.Services
{
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
            // Mengambil API Key dari Environment Variables Render (Resend__ApiKey) atau appsettings.json (Resend:ApiKey)
            var apiKey = _configuration["Resend:ApiKey"] ?? _configuration["Resend__ApiKey"];

            if (string.IsNullOrEmpty(apiKey) || apiKey.StartsWith("re_xxxxxxxxx"))
            {
                _logger.LogError("Resend API Key is missing or invalid!");
                throw new InvalidOperationException("Please replace 're_xxxxxxxxx' with your real Resend API Key in Environment Variables.");
            }

            try
            {
                // Inisialisasi ResendClient menggunakan API Key kamu
                IResend resend = ResendClient.Create(apiKey);

                var message = new EmailMessage()
                {
                    From = "Aumo Finance <onboarding@resend.dev>", // Domain bawaan Resend untuk testing
                    To = toEmail,
                    Subject = subject,
                    HtmlBody = htmlMessage
                };

                var resp = await resend.EmailSendAsync(message, ct);

                _logger.LogInformation("Email successfully sent to {ToEmail} via Resend. Message ID: {Id}", toEmail, resp.Content.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {ToEmail} via Resend API", toEmail);
                throw;
            }
        }
    }
}
