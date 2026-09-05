using AumoFinance.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers.Api;

[ApiController]
[Route("api/test-email")]
public class TestEmailController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailSender<ApplicationUser> _identityEmailSender;
    private readonly ILogger<TestEmailController> _logger;

    public TestEmailController(
        UserManager<ApplicationUser> userManager,
        IEmailSender<ApplicationUser> identityEmailSender,
        ILogger<TestEmailController> logger)
    {
        _userManager = userManager;
        _identityEmailSender = identityEmailSender;
        _logger = logger;
    }

    [HttpPost("resend-verification")]
    public async Task<IActionResult> ResendVerification([FromBody] ResendRequest request)
    {
        // 1. Cari user yang sudah ada di DB
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null)
        {
            return NotFound(new { success = false, message = $"User with email {request.Email} not found." });
        }

        try
        {
            // 2. Generate token Identity resmi
            var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
            var encodedToken = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(
                System.Text.Encoding.UTF8.GetBytes(token));

            // 3. Susun URL verifikasi ke domain Render
            var verificationUrl = $"https://aumo.onrender.com/auth/verify-email?Email={Uri.EscapeDataString(user.Email!)}&Token={encodedToken}";

            // 4. Kirim email lewat IEmailSender<ApplicationUser> yang terhubung ke MailKit
            await _identityEmailSender.SendConfirmationLinkAsync(user, user.Email!, verificationUrl);

            _logger.LogInformation("Verification email test sent to {Email}", user.Email);

            return Ok(new
            {
                success = true,
                message = $"Verification email triggered for {user.Email}",
                generatedLink = verificationUrl // Menampilkan link di Postman untuk cek manual jika email gagal
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed sending verification email to {Email}", user.Email);
            return StatusCode(500, new
            {
                success = false,
                error = ex.Message,
                innerError = ex.InnerException?.Message
            });
        }
    }
}

public record ResendRequest(string Email);
