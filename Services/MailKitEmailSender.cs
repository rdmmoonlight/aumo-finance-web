using MailKit.Net.Smtp;
using MailKit.Security;
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
            var senderEmail = _configuration["Smtp:User"];
            var pass = _configuration["Smtp:Pass"];
            var host = _configuration["Smtp:Host"] ?? "smtp.gmail.com";

            // Default ke port 587 jika tidak diisi
            if (!int.TryParse(_configuration["Smtp:Port"], out int port))
            {
                port = 587;
            }

            if (string.IsNullOrEmpty(senderEmail) || string.IsNullOrEmpty(pass))
            {
                _logger.LogError("SMTP Credentials (Smtp:User / Smtp:Pass) belum dikonfigurasi di Environment Variables!");
                return; // Jangan lemparkan exception agar tidak 500
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
                client.Timeout = 8000; // 8 detik max

                // Pilih opsi enkripsi sesuai port
                var socketOptions = port == 465
                    ? SecureSocketOptions.SslOnConnect
                    : SecureSocketOptions.StartTls;

                await client.ConnectAsync(host, port, socketOptions, ct);
                await client.AuthenticateAsync(senderEmail, pass, ct);
                await client.SendAsync(message, ct);
                await client.DisconnectAsync(true, ct);

                _logger.LogInformation("Email berhasil dikirim ke {ToEmail}", toEmail);
            }
            catch (Exception ex)
            {
                // Tangkap SEMUA error SMTP dan catat di Log Railway,
                // sehingga user UI tidak mendapat Error 500!
                _logger.LogError(ex, "Gagal mengirim email ke {ToEmail} via SMTP Gmail", toEmail);
            }
        }
    }
}