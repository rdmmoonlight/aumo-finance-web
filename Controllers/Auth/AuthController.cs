using System.Text;
using AumoFinance.Models;
using AumoFinance.Services;
using AumoFinance.Services.Security;
using Microsoft.AspNetCore.Authorization;
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
    // GET: /Auth/ResendVerification
    // ============================
    [HttpGet]
    [AllowAnonymous]
    public IActionResult ResendVerification()
    {
        return View(new ResendVerificationModel());
    }

    // ============================
    // POST: /Auth/ResendVerification
    // ============================
    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ResendVerification(ResendVerificationModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        // 1. Anti-Spam Cooldown Check via MemoryCache
        var cacheKey = $"ResendCooldown_{model.Email.Trim().ToLowerInvariant()}";
        if (_cache.TryGetValue(cacheKey, out _))
        {
            ModelState.AddModelError(string.Empty, "Please wait 1 minute before requesting another verification email.");
            return View(model);
        }

        // 2. Find User by Email
        var user = await _userManager.FindByEmailAsync(model.Email);

        // Anti-User Enumeration Practice:
        // If the user is not found, display a generic success message to prevent user enumeration
        if (user == null)
        {
            _logger.LogWarning("ResendVerification called for an unregistered email: {Email}", model.Email);
            _cache.Set(cacheKey, true, ResendCooldown);
            TempData["SuccessMessage"] = "If that email is registered, a new verification link has been sent to your inbox.";
            return RedirectToAction("Login");
        }

        // 3. Check if Email is Already Verified
        if (await _userManager.IsEmailConfirmedAsync(user))
        {
            TempData["InfoMessage"] = "Your email is already verified. Please sign in.";
            return RedirectToAction("Login");
        }

        // 4. Send Verification Email
        bool isSent = await SendEmailConfirmationAsync(user);

        if (isSent)
        {
            _cache.Set(cacheKey, true, ResendCooldown);
            TempData["SuccessMessage"] = "A verification link has been sent to your email. Please check your inbox or spam folder.";
        }
        else
        {
            TempData["ErrorMessage"] = "Failed to send verification email. Please ensure your SMTP configuration is active or try again later.";
        }

        return RedirectToAction("Login");
    }

    // ============================
    // PRIVATE HELPERS
    // ============================

    private async Task<bool> SendEmailConfirmationAsync(ApplicationUser user)
    {
        if (string.IsNullOrEmpty(user.Email))
        {
            _logger.LogWarning("User ID {UserId} does not have a valid email address.", user.Id);
            return false;
        }

        try
        {
            // Generate Token
            var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
            var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

            // Generate Action Link
            var confirmUrl = Url.Action(
                "VerifyEmail",
                "Auth",
                new { email = user.Email, token = encodedToken },
                Request.Scheme
            );

            if (string.IsNullOrEmpty(confirmUrl))
            {
                _logger.LogError("Failed to generate confirmUrl for {Email}", user.Email);
                return false;
            }

            // Send Email via Service
            await _emailSender.SendEmailAsync(
                user.Email,
                "Confirm your Aumo Finance account",
                EmailTemplates.EmailConfirmation(user.FullName, confirmUrl)
            );

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while sending the verification email to {Email}", user.Email);
            return false;
        }
    }
}
