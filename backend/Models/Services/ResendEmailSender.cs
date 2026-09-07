using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

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
}
