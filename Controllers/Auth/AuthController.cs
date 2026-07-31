using System.Text;
using AumoFinance.Models;
using AumoFinance.Services;
using AumoFinance.Services.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Caching.Memory;

namespace AumoFinance.Controllers;

public partial class AuthController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IEmailSender _emailSender;
    private readonly IMemoryCache _cache;
    private readonly IGuardianService _guardianService;
    private readonly ILogger<AuthController> _logger;

    private static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IEmailSender emailSender,
        IMemoryCache cache,
        IGuardianService guardianService,
        ILogger<AuthController> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _emailSender = emailSender;
        _cache = cache;
        _guardianService = guardianService;
        _logger = logger;
    }

    // ============================
    // PRIVATE HELPERS
    // ============================

    private async Task SendEmailConfirmationAsync(ApplicationUser user)
    {
        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

        var confirmUrl = Url.Action(
            "VerifyEmail",
            "Auth",
            new { email = user.Email, token = encodedToken },
            Request.Scheme
        );

        try
        {
            await _emailSender.SendEmailAsync(
                user.Email!,
                "Confirm your Aumo Finance account",
                EmailTemplates.EmailConfirmation(user.FullName, confirmUrl!)
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email confirmation to {Email}", user.Email);
        }
    }
}
