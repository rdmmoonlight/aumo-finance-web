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
            var port = int.Parse(_configuration["Smtp:Port"] ?? "465");

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress("Aurum Finance", senderEmail));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = subject;

            var bodyBuilder = new BodyBuilder { HtmlBody = htmlMessage };
            message.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient();
            client.Timeout = 10000; // Limit 10 detik

            try
            {
                var socketOptions = port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
                await client.ConnectAsync(host, port, socketOptions, ct);
                await client.AuthenticateAsync(senderEmail, pass, ct);
                await client.SendAsync(message, ct);
            }
            finally
            {
                await client.DisconnectAsync(true, ct);
            }
        }
    }
}