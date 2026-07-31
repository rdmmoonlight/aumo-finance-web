using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;

namespace AumoFinance.Controllers;

public partial class AuthController
{
    // ============================
    // GET: /Auth/VerifyEmail
    // ============================
    [HttpGet]
    public async Task<IActionResult> VerifyEmail(string email, string token)
    {
        // 1. Validasi Parameter Masukan
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(token))
        {
            TempData["ErrorMessage"] = "Link konfirmasi tidak valid atau parameter tidak lengkap.";
            return RedirectToAction("Login");
        }

        // 2. Cari User Berdasarkan Email
        var user = await _userManager.FindByEmailAsync(email);
        if (user == null)
        {
            TempData["ErrorMessage"] = "Gagal memverifikasi email. Akun tidak ditemukan.";
            return RedirectToAction("Login");
        }

        // 3. Cek Apakah Email Sudah Terkonfirmasi
        if (await _userManager.IsEmailConfirmedAsync(user))
        {
            TempData["InfoMessage"] = "Email Anda sudah terverifikasi sebelumnya. Silakan login.";
            return RedirectToAction("Login");
        }

        try
        {
            // 4. Decode Token Base64Url
            var decodedTokenBytes = WebEncoders.Base64UrlDecode(token);
            var originalToken = Encoding.UTF8.GetString(decodedTokenBytes);

            // 5. Verifikasi Token di Identity
            var result = await _userManager.ConfirmEmailAsync(user, originalToken);

            if (result.Succeeded)
            {
                _logger.LogInformation("Email {Email} berhasil diverifikasi.", email);
                TempData["SuccessMessage"] = "Email Anda berhasil diverifikasi! Silakan login untuk melanjutkan.";
                return RedirectToAction("Login");
            }

            // Jika Token Expired / Invalid
            _logger.LogWarning("Gagal verifikasi email untuk {Email}: {Errors}", 
                email, string.Join(", ", result.Errors.Select(e => e.Description)));
                
            TempData["ErrorMessage"] = "Link verifikasi sudah kadaluwarsa atau tidak valid. Silakan minta link baru.";
        }
        catch (FormatException ex)
        {
            _logger.LogError(ex, "Format token tidak valid untuk {Email}", email);
            TempData["ErrorMessage"] = "Format token verifikasi tidak valid.";
        }

        return RedirectToAction("ResendVerification");
    }
}
