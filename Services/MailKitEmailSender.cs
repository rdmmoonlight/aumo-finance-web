using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace AumoFinance.Services
{
    public class MailKitEmailSender : IEmailSender
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<MailKitEmailSender> _logger;

        public MailKitEmailSender(IConfiguration configuration, ILogger<MailKitEmailSender> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string htmlMessage, CancellationToken ct = default)
        {
            var senderEmail = _configuration["Smtp:User"] ?? _configuration["Smtp__User"];
            var pass = _configuration["Smtp:Pass"] ?? _configuration["Smtp__Pass"];
            var host = _configuration["Smtp:Host"] ?? _configuration["Smtp__Host"] ?? "smtp.gmail.com";

            var portStr = _configuration["Smtp:Port"] ?? _configuration["Smtp__Port"];
            if (!int.TryParse(portStr, out int port))
            {
                port = 465; // Default aman untuk Render
            }

            if (string.IsNullOrEmpty(senderEmail) || string.IsNullOrEmpty(pass))
            {
                throw new InvalidOperationException("SMTP credentials are not configured on the server.");
            }

            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress("Aumo Finance", senderEmail));
                message.To.Add(MailboxAddress.Parse(toEmail));
                message.Subject = subject;

                var bodyBuilder = new BodyBuilder { HtmlBody = htmlMessage };
                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                
                // Tambah timeout menjadi 30 detik untuk mengantisipasi jaringan Render free tier
                client.Timeout = 30000;

                // Port 465 WAJIB pakai SslOnConnect langsung sejak jabat tangan awal
                SecureSocketOptions socketOptions = port switch
                {
                    465 => SecureSocketOptions.SslOnConnect,
                    587 => SecureSocketOptions.StartTls,
                    _ => SecureSocketOptions.Auto
                };

                // Bypass SSL Validation untuk container Linux Render
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;

                _logger.LogInformation("Connecting to SMTP server {Host}:{Port} using {Options}...", host, port, socketOptions);

                await client.ConnectAsync(host, port, socketOptions, ct);
                await client.AuthenticateAsync(senderEmail, pass, ct);
                await client.SendAsync(message, ct);
                await client.DisconnectAsync(true, ct);

                _logger.LogInformation("Email successfully sent to {ToEmail}", toEmail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {ToEmail} via SMTP {Host}:{Port}", toEmail, host, port);
                throw;
            }
        }
    }
}
