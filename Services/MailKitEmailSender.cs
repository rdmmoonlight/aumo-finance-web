using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace AurumFinance.Services
{
    public class MailKitEmailSender : IEmailSender
    {
        private readonly IConfiguration _configuration;

        public MailKitEmailSender(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string htmlMessage, CancellationToken ct = default)
        {
            var senderEmail = _configuration["Smtp:User"];
            var pass = _configuration["Smtp:Pass"];
            var host = _configuration["Smtp:Host"] ?? "smtp.gmail.com";
            var port = int.Parse(_configuration["Smtp:Port"] ?? "587");

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress("Aurum Finance", senderEmail));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = subject;

            var bodyBuilder = new BodyBuilder
            {
                HtmlBody = htmlMessage
            };
            message.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient();
            try
            {
                // Menghubungkan ke server SMTP dengan Cancellation Token support
                await client.ConnectAsync(host, port, SecureSocketOptions.StartTls, ct);

                // Autentikasi menggunakan Gmail App Password
                await client.AuthenticateAsync(senderEmail, pass, ct);

                // Kirim email
                await client.SendAsync(message, ct);
            }
            finally
            {
                await client.DisconnectAsync(true, ct);
            }
        }
    }
}