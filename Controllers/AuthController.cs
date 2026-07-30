using System.Text;
using AumoFinance.Models;
using AumoFinance.Models.Security;
using AumoFinance.Services;
using AumoFinance.Services.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Caching.Memory;

namespace AumoFinance.Controllers;

public class AuthController : Controller
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
    // LOGIN
    // ============================

    [HttpGet]
    [AllowAnonymous]
    public IActionResult Login()
    {
        return View(new LoginViewModel());
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        // 1. Cari user berdasarkan email terlebih dahulu
        var user = await _userManager.FindByEmailAsync(model.Email);

        if (user == null)
        {
            ModelState.AddModelError(string.Empty, "Invalid email or password.");
            return View(model);
        }

        // 2. Gunakan user.UserName untuk PasswordSignInAsync agar akurat
        var result = await _signInManager.PasswordSignInAsync(
            user.UserName!,
            model.Password,
            isPersistent: true,
            lockoutOnFailure: true
        );

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
        var userAgent = Request.Headers.UserAgent.ToString();

        if (result.Succeeded)
        {
            await _guardianService.CreateLoginActivityAsync(
                user.Id,
                "Login Success",
                userAgent,
                userAgent,
                ipAddress,
                "",
                true
            );

            await _guardianService.CreateSessionAsync(
                user.Id,
                userAgent,
                userAgent,
                ipAddress,
                "",
                Guid.NewGuid().ToString()
            );

            return RedirectToAction("Index", "Home");
        }

        // Ambil riwayat kegagalan login untuk sistem Guardian Security
        await _guardianService.CreateLoginActivityAsync(
            user.Id,
            "Login Failed",
            userAgent,
            userAgent,
            ipAddress,
            "",
            false
        );

        if (result.IsNotAllowed)
        {
            ModelState.AddModelError(string.Empty, "Please verify your email address before logging in.");
        }
        else if (result.IsLockedOut)
        {
            ModelState.AddModelError(string.Empty, "This account is temporarily locked out due to too many failed attempts.");
        }
        else
        {
            ModelState.AddModelError(string.Empty, "Invalid email or password.");
        }

        return View(model);
    }

    // ============================
    // REGISTER
    // ============================

    [HttpGet]
    [AllowAnonymous]
    public IActionResult Register()
    {
        return View(new RegisterViewModel());
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Register(RegisterViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var user = new ApplicationUser
        {
            UserName = model.Email,
            Email = model.Email,
            FullName = model.FullName
        };

        var createResult = await _userManager.CreateAsync(user, model.Password);

        if (!createResult.Succeeded)
        {
            foreach (var error in createResult.Errors)
            {
                ModelState.AddModelError(string.Empty, error.Description);
            }

            return View(model);
        }

        await SendEmailConfirmationAsync(user);

        ViewBag.ShowSuccessModal = true;
        ViewBag.RegisteredEmail = model.Email;

        ModelState.Clear();

        return View(new RegisterViewModel());
    }

    // ============================
    // LOGOUT
    // ============================

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var user = await _userManager.GetUserAsync(User);

        if (user != null)
        {
            var sessions = await _guardianService.GetActiveSessionsAsync(user.Id);
            var currentSession = sessions.FirstOrDefault(x => x.IsCurrent);

            if (currentSession != null)
            {
                await _guardianService.RevokeSessionAsync(currentSession.Id, user.Id);
            }
        }

        await _signInManager.SignOutAsync();

        return RedirectToAction("Login", "Auth");
    }

    // ============================
    // FORGOT & RESET PASSWORD
    // ============================

    [HttpGet]
    [AllowAnonymous]
    public IActionResult ForgotPassword()
    {
        return View(new ForgotPasswordModel());
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var user = await _userManager.FindByEmailAsync(model.Email);

        if (user != null)
        {
            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

            var resetUrl = Url.Action(
                "ResetPassword",
                "Auth",
                new { email = user.Email, token = encodedToken },
                Request.Scheme
            );

            try
            {
                await _emailSender.SendEmailAsync(
                    user.Email!,
                    "Reset your Aumo Finance password",
                    EmailTemplates.PasswordReset(user.FullName, resetUrl!)
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending reset password email.");
            }
        }

        TempData["SuccessMessage"] = "If that email is registered, a password reset link has been sent.";

        return RedirectToAction("Login");
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult ResetPassword(string email, string token)
    {
        return View(new ResetPasswordModel
        {
            Email = email ?? string.Empty,
            Token = token ?? string.Empty
        });
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ResetPassword(ResetPasswordModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var user = await _userManager.FindByEmailAsync(model.Email);

        if (user == null)
        {
            ModelState.AddModelError(string.Empty, "This reset link is invalid or has expired.");
            return View(model);
        }

        string decodedToken;

        try
        {
            decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(model.Token));
        }
        catch (FormatException)
        {
            ModelState.AddModelError(string.Empty, "This reset link is invalid or has expired.");
            return View(model);
        }

        var result = await _userManager.ResetPasswordAsync(user, decodedToken, model.NewPassword);

        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(string.Empty, error.Description);
            }

            return View(model);
        }

        TempData["SuccessMessage"] = "Password changed successfully. Please sign in with your new password.";

        return RedirectToAction("Login");
    }

    // ============================
    // EMAIL VERIFICATION
    // ============================

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyEmail(string email, string token)
    {
        var user = string.IsNullOrEmpty(email) ? null : await _userManager.FindByEmailAsync(email);

        if (user == null || string.IsNullOrEmpty(token))
        {
            ViewBag.Success = false;
            ViewBag.Message = "This verification link is invalid.";
            return View();
        }

        try
        {
            var decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(token));
            var result = await _userManager.ConfirmEmailAsync(user, decodedToken);

            ViewBag.Success = result.Succeeded;
            ViewBag.Message = result.Succeeded
                ? "Your email has been successfully verified!"
                : "This verification link is invalid or has expired.";
        }
        catch (FormatException)
        {
            ViewBag.Success = false;
            ViewBag.Message = "This verification link is invalid.";
        }

        return View();
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult ResendVerification()
    {
        return View(new ResendVerificationModel());
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ResendVerification(ResendVerificationModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var normalizedEmail = model.Email.Trim().ToLowerInvariant();
        var cacheKey = $"resend-verification-cooldown:{normalizedEmail}";

        if (!_cache.TryGetValue(cacheKey, out _))
        {
            var user = await _userManager.FindByEmailAsync(model.Email);

            if (user != null && !await _userManager.IsEmailConfirmedAsync(user))
            {
                await SendEmailConfirmationAsync(user);
            }

            _cache.Set(cacheKey, true, ResendCooldown);
        }

        TempData["SuccessMessage"] = "If that email is registered and not yet verified, a new link has been sent.";

        return RedirectToAction("Login");
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
            // Menangkap error pengiriman email agar aplikasi TIDAK melempar HTTP 500
            _logger.LogError(ex, "Failed to send email confirmation to {Email}", user.Email);
        }
    }
}
