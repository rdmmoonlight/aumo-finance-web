using System.Net;
using System.Net.Mail;

namespace AumoFinance.Services;

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
