namespace AumoFinance.Services;

public class LoggingEmailSender : IEmailSender
{
    private readonly ILogger<LoggingEmailSender> _logger;

    public LoggingEmailSender(ILogger<LoggingEmailSender> logger)
    {
        _logger = logger;
    }

    public Task SendEmailAsync(string toEmail, string subject, string htmlMessage, CancellationToken ct = default)
    {
        _logger.LogInformation("=========================================");
        _logger.LogInformation("SIMULATED EMAIL TO: {ToEmail}", toEmail);
        _logger.LogInformation("SUBJECT: {Subject}", subject);
        _logger.LogInformation("BODY: {Body}", htmlMessage);
        _logger.LogInformation("=========================================");

        return Task.CompletedTask;
    }
}
