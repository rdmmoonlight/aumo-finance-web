using System.Text;
using AumoFinance.Models;
using AumoFinance.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;

namespace AumoFinance.Controllers
{
    [AllowAnonymous]
    public class AuthController : Controller
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly IEmailSender _emailSender;

        public AuthController(
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            IEmailSender emailSender)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _emailSender = emailSender;
        }

        // GET: /Auth/Login
        [HttpGet]
        public IActionResult Login()
        {
            return View(new LoginViewModel());
        }

        // POST: /Auth/Login
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(LoginViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var result = await _signInManager.PasswordSignInAsync(
                model.Email, model.Password, isPersistent: true, lockoutOnFailure: true);

            if (result.Succeeded)
            {
                return RedirectToAction("Index", "Home");
            }

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

        // GET: /Auth/Register
        [HttpGet]
        public IActionResult Register()
        {
            return View(new RegisterViewModel());
        }

        // POST: /Auth/Register
        [HttpPost]
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
                FullName = model.FullName,
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

        // GET: /Auth/Logout
        [HttpGet]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            await _signInManager.SignOutAsync();
            return RedirectToAction("Login", "Auth");
        }

        // GET: /Auth/ForgotPassword
        [HttpGet]
        public IActionResult ForgotPassword()
        {
            return View(new ForgotPasswordModel());
        }

        // POST: /Auth/ForgotPassword
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ForgotPassword(ForgotPasswordModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var user = await _userManager.FindByEmailAsync(model.Email);
            if (user is not null)
            {
                var token = await _userManager.GeneratePasswordResetTokenAsync(user);
                var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
                var resetUrl = Url.Action("ResetPassword", "Auth", new { email = user.Email, token = encodedToken }, Request.Scheme);

                await _emailSender.SendEmailAsync(
                    user.Email!,
                    "Reset your Aumo Finance password",
                    $"Reset your password by clicking <a href='{resetUrl}'>here</a>.");
            }

            // Same message whether or not the email is registered — avoids account enumeration.
            TempData["SuccessMessage"] = "If that email is registered, a password reset link has been sent.";
            return RedirectToAction("Login");
        }

        // GET: /Auth/ResetPassword?email=...&token=...
        [HttpGet]
        public IActionResult ResetPassword(string email, string token)
        {
            return View(new ResetPasswordModel { Email = email ?? string.Empty, Token = token ?? string.Empty });
        }

        // POST: /Auth/ResetPassword
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ResetPassword(ResetPasswordModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var user = await _userManager.FindByEmailAsync(model.Email);
            if (user is null)
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

        // GET: /Auth/VerifyEmail?email=...&token=...
        [HttpGet]
        public async Task<IActionResult> VerifyEmail(string email, string token)
        {
            var user = string.IsNullOrEmpty(email) ? null : await _userManager.FindByEmailAsync(email);

            if (user is null || string.IsNullOrEmpty(token))
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

        // GET: /Auth/ResendVerification
        [HttpGet]
        public IActionResult ResendVerification()
        {
            return View(new ResendVerificationModel());
        }

        // POST: /Auth/ResendVerification
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ResendVerification(ResendVerificationModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var user = await _userManager.FindByEmailAsync(model.Email);
            if (user is not null && !await _userManager.IsEmailConfirmedAsync(user))
            {
                await SendEmailConfirmationAsync(user);
            }

            // Same message whether or not the email is registered/already verified.
            TempData["SuccessMessage"] = "If that email is registered and not yet verified, a new link has been sent.";
            return RedirectToAction("Login");
        }

        private async Task SendEmailConfirmationAsync(ApplicationUser user)
        {
            var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
            var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
            var confirmUrl = Url.Action("VerifyEmail", "Auth", new { email = user.Email, token = encodedToken }, Request.Scheme);

            await _emailSender.SendEmailAsync(
                user.Email!,
                "Confirm your Aumo Finance account",
                $"Confirm your account by clicking <a href='{confirmUrl}'>here</a>.");
        }
    }
}
