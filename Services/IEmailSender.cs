namespace AumoFinance.Services;

/// <summary>
/// Minimal mail abstraction used by Identity's account-confirmation and
/// password-reset flows.
/// </summary>
public interface IEmailSender
{
    Task SendEmailAsync(string toEmail, string subject, string htmlMessage, CancellationToken ct = default);
}
