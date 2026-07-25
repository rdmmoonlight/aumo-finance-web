using Microsoft.Extensions.Logging;

namespace AumoFinance.Services
{
    /// <summary>
    /// Default IEmailSender: writes the message to the log instead of
    /// delivering it. Keeps Register/ForgotPassword/ResendVerification
    /// fully functional out of the box, with no external mail dependency
    /// or cost. Replace with a real provider before shipping to real users.
    /// </summary>
    public class LoggingEmailSender : IEmailSender
    {
        private readonly ILogger<LoggingEmailSender> _logger;

        public LoggingEmailSender(ILogger<LoggingEmailSender> logger)
        {
            _logger = logger;
        }

        public Task SendEmailAsync(string toEmail, string subject, string htmlMessage, CancellationToken ct = default)
        {
            _logger.LogInformation("Email to {ToEmail} — {Subject}\n{Body}", toEmail, subject, htmlMessage);
            return Task.CompletedTask;
        }
    }
}
