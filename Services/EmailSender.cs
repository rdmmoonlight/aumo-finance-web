namespace AumoFinance.Services;

public interface IEmailSender
{
    Task SendEmailAsync(string email, string subject, string htmlMessage);
}

// Contoh implementasi menggunakan Mailkit / SmtpClient
public class EmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailSender> _logger;

    public EmailSender(IConfiguration config, ILogger<EmailSender> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendEmailAsync(string email, string subject, string htmlMessage)
    {
        // Pastikan konfigurasi SMTP tersedia
        var host = _config["Smtp:Host"];
        var port = int.Parse(_config["Smtp:Port"] ?? "587");
        var username = _config["Smtp:Username"];
        var password = _config["Smtp:Password"];

        using var client = new System.Net.Mail.SmtpClient(host, port)
        {
            Credentials = new System.Net.NetworkCredential(username, password),
            EnableSsl = true
        };

        var mailMessage = new System.Net.Mail.MailMessage
        {
            From = new System.Net.Mail.MailAddress(username!, "Aumo Finance"),
            Subject = subject,
            Body = htmlMessage,
            IsBodyHtml = true
        };

        mailMessage.To.Add(email);

        _logger.LogInformation("Attempting to send email to {Email} via SMTP...", email);
        await client.SendMailAsync(mailMessage);
        _logger.LogInformation("Email successfully sent to {Email}", email);
    }
}
