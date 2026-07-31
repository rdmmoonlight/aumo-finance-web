using System.Text;
using AumoFinance.Models;
using AumoFinance.Models.Security;
using AumoFinance.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Caching.Memory;

namespace AumoFinance.Controllers;

public partial class AuthController
{
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
    public async Task<IActionResult> ForgotPassword(ForgotPasswordModel model, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var user = await _userManager.FindByEmailAsync(model.Email);

        if (user != null && !string.IsNullOrEmpty(user.Email))
        {
            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

            var resetUrl = Url.Action(
                "ResetPassword",
                "Auth",
                new { email = user.Email, token = encodedToken },
                Request.Scheme
            );

            if (!string.IsNullOrEmpty(resetUrl))
            {
                try
                {
                    await _emailSender.SendEmailAsync(
                        user.Email,
                        "Reset your Aumo Finance password",
                        EmailTemplates.PasswordReset(user.FullName, resetUrl),
                        cancellationToken
                    );
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send reset password email to {Email}", user.Email);
                    TempData["ErrorMessage"] = "Failed to send reset email due to a system error. Please try again later.";
                    return RedirectToAction("Login");
                }
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
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(token))
        {
            TempData["ErrorMessage"] = "This verification link is invalid.";
            return RedirectToAction("Login");
        }

        var user = await _userManager.FindByEmailAsync(email);

        if (user == null)
        {
            TempData["ErrorMessage"] = "This verification link is invalid.";
            return RedirectToAction("Login");
        }

        if (await _userManager.IsEmailConfirmedAsync(user))
        {
            TempData["InfoMessage"] = "Your email is already verified. Please sign in.";
            return RedirectToAction("Login");
        }

        try
        {
            var decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(token));
            var result = await _userManager.ConfirmEmailAsync(user, decodedToken);

            if (result.Succeeded)
            {
                TempData["SuccessMessage"] = "Your email has been successfully verified! Please sign in.";
                return RedirectToAction("Login");
            }

            TempData["ErrorMessage"] = "This verification link is invalid or has expired.";
        }
        catch (FormatException)
        {
            TempData["ErrorMessage"] = "This verification link format is invalid.";
        }

        return RedirectToAction("ResendVerification");
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

        if (_cache.TryGetValue(cacheKey, out _))
        {
            ModelState.AddModelError(string.Empty, "Please wait a moment before requesting another verification link.");
            return View(model);
        }

        var user = await _userManager.FindByEmailAsync(model.Email);

        if (user != null && !await _userManager.IsEmailConfirmedAsync(user))
        {
            try
            {
                await SendEmailConfirmationAsync(user);
                _cache.Set(cacheKey, true, ResendCooldown);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while resending verification email to {Email}", model.Email);
                TempData["ErrorMessage"] = "Failed to send verification email. Please try again later.";
                return RedirectToAction("Login");
            }
        }
        else
        {
            // Set cooldown walau user null (Anti-enumeration)
            _cache.Set(cacheKey, true, ResendCooldown);
        }

        TempData["SuccessMessage"] = "If that email is registered and not yet verified, a new link has been sent.";
        return RedirectToAction("Login");
    }
}
