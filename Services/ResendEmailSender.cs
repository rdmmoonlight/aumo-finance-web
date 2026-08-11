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
            // Read API Key supporting both appsettings.json (Resend:ApiKey) and Render Environment Variables (Resend__ApiKey)
            var apiKey = _configuration["Resend:ApiKey"] ?? _configuration["Resend__ApiKey"];

            if (string.IsNullOrEmpty(apiKey) || apiKey.Contains("xxxxxxxxx"))
            {
                _logger.LogError("Resend API Key is missing or invalid in environment variables!");
                throw new InvalidOperationException("Resend API Key is not configured on the server.");
            }

            try
            {
                // Create the Resend client instance using your API key
                IResend resend = ResendClient.Create(apiKey);

                var message = new EmailMessage
                {
                    From = "Aumo Finance <onboarding@resend.dev>", // Default onboarding sender address for Resend testing
                    To = toEmail,
                    Subject = subject,
                    HtmlBody = htmlMessage
                };

                _logger.LogInformation("Sending email to {ToEmail} via Resend API...", toEmail);

                var response = await resend.EmailSendAsync(message, ct);

                _logger.LogInformation("Email successfully sent to {ToEmail}. Message ID: {Id}", toEmail, response.Content.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {ToEmail} via Resend API", toEmail);
                throw;
            }
        }
    }
}
