namespace AumoFinance.Services
{
    /// <summary>
    /// Minimal mail abstraction used by Identity's account-confirmation and
    /// password-reset flows. Swap the implementation registered in
    /// Program.cs for a real provider (SMTP, etc.) when one is available;
    /// until then, LoggingEmailSender writes the link to the application
    /// log so every flow stays fully testable at zero cost.
    /// </summary>
    public interface IEmailSender
    {
        Task SendEmailAsync(string toEmail, string subject, string htmlMessage, CancellationToken ct = default);
    }
}
