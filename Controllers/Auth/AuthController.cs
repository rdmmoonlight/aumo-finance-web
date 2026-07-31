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
    // GET: /Auth/ResendVerification
    // ============================
    [HttpGet]
    public IActionResult ResendVerification()
    {
        return View();
    }

    // ============================
    // POST: /Auth/ResendVerification
    // ============================
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ResendVerification(ResendVerificationModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        // 1. Cek Cooldown Anti-Spam via MemoryCache
        var cacheKey = $"ResendCooldown_{model.Email.ToLowerInvariant()}";
        if (_cache.TryGetValue(cacheKey, out _))
        {
            ModelState.AddModelError(string.Empty, "Tunggu 1 menit sebelum meminta email verifikasi lagi.");
            return View(model);
        }

        // 2. Cari User Berdasarkan Email
        var user = await _userManager.FindByEmailAsync(model.Email);
        
        // Praktik Keamanan (Anti-User Enumeration):
        // Jika user tidak ditemukan, tampilkan pesan sukses seolah-olah dikirim agar tidak membocorkan data email
        if (user == null)
        {
            _logger.LogWarning("ResendVerification dipanggil untuk email yang tidak terdaftar: {Email}", model.Email);
            TempData["SuccessMessage"] = "Jika email terdaftar, instruksi verifikasi telah dikirim ke inbox Anda.";
            return RedirectToAction("Login");
        }

        // 3. Cek Apakah Email Sudah Terverifikasi
        if (await _userManager.IsEmailConfirmedAsync(user))
        {
            TempData["InfoMessage"] = "Email Anda sudah terverifikasi. Silakan login.";
            return RedirectToAction("Login");
        }

        // 4. Kirim Email Verifikasi
        bool isSent = await SendEmailConfirmationAsync(user);

        if (isSent)
        {
            // Simpan cooldown ke cache jika sukses
            _cache.Set(cacheKey, true, ResendCooldown);
            TempData["SuccessMessage"] = "Link verifikasi telah dikirim ke email Anda. Silakan cek inbox/spam.";
        }
        else
        {
            TempData["ErrorMessage"] = "Gagal mengirim email verifikasi. Pastikan konfigurasi SMTP aktif atau coba lagi nanti.";
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
            _logger.LogWarning("User ID {UserId} tidak memiliki alamat email yang valid.", user.Id);
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
                new { userId = user.Id, token = encodedToken },
                Request.Scheme
            );

            if (string.IsNullOrEmpty(confirmUrl))
            {
                _logger.LogError("Gagal membuat confirmUrl untuk {Email}", user.Email);
                return false;
            }

            // Kirim Email via Service
            await _emailSender.SendEmailAsync(
                user.Email,
                "Confirm your Aumo Finance account",
                EmailTemplates.EmailConfirmation(user.FullName, confirmUrl)
            );

            return true;
        }
        catch (Exception ex)
        {
            // Catat error lengkap di log console/file
            _logger.LogError(ex, "Terjadi kesalahan saat pengiriman email verifikasi ke {Email}", user.Email);
            return false;
        }
    }
}
