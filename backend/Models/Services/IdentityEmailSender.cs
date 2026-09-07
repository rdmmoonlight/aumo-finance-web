using Microsoft.AspNetCore.Identity;
using AumoFinance.Models;

namespace AumoFinance.Services;

public class IdentityEmailSender : IEmailSender<ApplicationUser>
{
    private readonly IEmailSender _mailSender; // Your underlying SMTP/Service interface

    public IdentityEmailSender(IEmailSender mailSender)
    {
        _mailSender = mailSender;
    }

    public Task SendConfirmationLinkAsync(ApplicationUser user, string email, string confirmationLink)
    {
        var htmlBody = $"Please confirm your account by <a href='{confirmationLink}'>clicking here</a>.";
        return _mailSender.SendEmailAsync(email, "Confirm your email - Aumo Finance", htmlBody);
    }

    public Task SendPasswordResetLinkAsync(ApplicationUser user, string email, string resetLink)
    {
        var htmlBody = $"Please reset your password by <a href='{resetLink}'>clicking here</a>.";
        return _mailSender.SendEmailAsync(email, "Reset your password - Aumo Finance", htmlBody);
    }

    public Task SendPasswordResetCodeAsync(ApplicationUser user, string email, string resetCode)
    {
        var htmlBody = $"Your password reset code is: <strong>{resetCode}</strong>";
        return _mailSender.SendEmailAsync(email, "Password Reset Code - Aumo Finance", htmlBody);
    }
}
