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


    private static readonly TimeSpan ResendCooldown =
        TimeSpan.FromSeconds(60);



    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IEmailSender emailSender,
        IMemoryCache cache,
        IGuardianService guardianService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _emailSender = emailSender;
        _cache = cache;
        _guardianService = guardianService;
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
    public async Task<IActionResult> Login(
        LoginViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }


        var result =
            await _signInManager.PasswordSignInAsync(
                model.Email,
                model.Password,
                true,
                true
            );



        if (result.Succeeded)
        {
            var user =
                await _userManager.FindByEmailAsync(
                    model.Email
                );


            if (user != null)
            {
                await CreateGuardianRecordAsync(user);
            }


            return RedirectToAction(
                "Index",
                "Home"
            );
        }



        if (result.IsNotAllowed)
        {
            ModelState.AddModelError(
                "",
                "Please verify your email before login."
            );
        }
        else if (result.IsLockedOut)
        {
            ModelState.AddModelError(
                "",
                "Account temporarily locked."
            );
        }
        else
        {
            ModelState.AddModelError(
                "",
                "Invalid email or password."
            );
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
    public async Task<IActionResult> Register(
        RegisterViewModel model)
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


        var result =
            await _userManager.CreateAsync(
                user,
                model.Password
            );


        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(
                    "",
                    error.Description
                );
            }


            return View(model);
        }


        await SendEmailConfirmationAsync(user);


        ViewBag.ShowSuccessModal = true;

        ViewBag.RegisteredEmail =
            model.Email;


        return View(
            new RegisterViewModel()
        );
    }



    // ============================
    // LOGOUT
    // ============================

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var user =
            await _userManager.GetUserAsync(User);


        if (user != null)
        {
            await _guardianService.RevokeCurrentSessionAsync(
                user.Id
            );
        }


        await _signInManager.SignOutAsync();


        return RedirectToAction(
            "Login"
        );
    }



    // ============================
    // CREATE GUARDIAN RECORD
    // ============================

    private async Task CreateGuardianRecordAsync(
        ApplicationUser user)
    {
        var ip =
            HttpContext.Connection.RemoteIpAddress?
            .ToString()
            ?? "Unknown";


        var agent =
            Request.Headers.UserAgent.ToString();



        await _guardianService.CreateLoginActivityAsync(
            new LoginActivity
            {
                UserId = user.Id,
                ActivityType = "Login",
                IsSuccess = true,
                IpAddress = ip,
                UserAgent = agent,
                Device = "Web Browser",
                Browser = agent,
                CreatedAt = DateTime.UtcNow
            }
        );



        await _guardianService.CreateSessionAsync(
            new UserSession
            {
                UserId = user.Id,
                DeviceName =
                    Environment.MachineName,

                Browser = agent,

                IpAddress = ip,

                UserAgent = agent,

                IsActive = true,

                IsCurrent = true,

                CreatedAt =
                    DateTime.UtcNow,

                LastActivityAt =
                    DateTime.UtcNow
            }
        );
    }



    // ============================
    // EMAIL CONFIRMATION
    // ============================

    private async Task SendEmailConfirmationAsync(
        ApplicationUser user)
    {
        var token =
            await _userManager
            .GenerateEmailConfirmationTokenAsync(user);



        var encoded =
            WebEncoders.Base64UrlEncode(
                Encoding.UTF8.GetBytes(token)
            );



        var url =
            Url.Action(
                "VerifyEmail",
                "Auth",
                new
                {
                    email = user.Email,
                    token = encoded
                },
                Request.Scheme
            );



        await _emailSender.SendEmailAsync(
            user.Email!,
            "Confirm your Aumo Finance account",
            EmailTemplates.EmailConfirmation(
                user.FullName,
                url!
            )
        );
    }
}        }


        // GET: /Auth/Login
        [HttpGet]
        [AllowAnonymous]
        public IActionResult Login()
        {
            return View(new LoginViewModel());
        }


        // POST: /Auth/Login
        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(LoginViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }


            var user =
                await _userManager.FindByEmailAsync(model.Email);


            var result =
                await _signInManager.PasswordSignInAsync(
                    model.Email,
                    model.Password,
                    isPersistent: true,
                    lockoutOnFailure: true
                );


            if (result.Succeeded && user != null)
            {
                var ipAddress =
                    HttpContext.Connection.RemoteIpAddress?
                    .ToString()
                    ?? "Unknown";


                var browser =
                    Request.Headers["User-Agent"]
                    .ToString();


                await _guardianService.CreateLoginActivityAsync(
                    user.Id,
                    "Login Success",
                    browser,
                    browser,
                    ipAddress,
                    "",
                    true
                );


                await _guardianService.CreateSessionAsync(
                    user.Id,
                    browser,
                    browser,
                    ipAddress,
                    "",
                    Guid.NewGuid().ToString()
                );


                return RedirectToAction(
                    "Index",
                    "Home"
                );
            }


            if (user != null)
            {
                await _guardianService.CreateLoginActivityAsync(
                    user.Id,
                    "Login Failed",
                    Request.Headers["User-Agent"].ToString(),
                    Request.Headers["User-Agent"].ToString(),
                    HttpContext.Connection.RemoteIpAddress?
                        .ToString()
                        ?? "Unknown",
                    "",
                    false
                );
            }


            if (result.IsNotAllowed)
            {
                ModelState.AddModelError(
                    string.Empty,
                    "Please verify your email address before logging in."
                );
            }
            else if (result.IsLockedOut)
            {
                ModelState.AddModelError(
                    string.Empty,
                    "This account is temporarily locked out due to too many failed attempts."
                );
            }
            else
            {
                ModelState.AddModelError(
                    string.Empty,
                    "Invalid email or password."
                );
            }


            return View(model);
        }



        // GET: /Auth/Register
        [HttpGet]
        [AllowAnonymous]
        public IActionResult Register()
        {
            return View(new RegisterViewModel());
        }


        // POST: /Auth/Register
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


            var createResult =
                await _userManager.CreateAsync(
                    user,
                    model.Password
                );


            if (!createResult.Succeeded)
            {
                foreach (var error in createResult.Errors)
                {
                    ModelState.AddModelError(
                        string.Empty,
                        error.Description
                    );
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
            var user =
                await _userManager.GetUserAsync(User);


            if (user != null)
            {
                var sessions =
                    await _guardianService
                    .GetActiveSessionsAsync(user.Id);


                var currentSession =
                    sessions.FirstOrDefault(
                        x => x.IsCurrent
                    );


                if (currentSession != null)
                {
                    await _guardianService.RevokeSessionAsync(
                        currentSession.Id,
                        user.Id
                    );
                }
            }


            await _signInManager.SignOutAsync();


            return RedirectToAction(
                "Login",
                "Auth"
            );
        }
                // GET: /Auth/ForgotPassword
        [HttpGet]
        [AllowAnonymous]
        public IActionResult ForgotPassword()
        {
            return View(new ForgotPasswordModel());
        }


        // POST: /Auth/ForgotPassword
        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ForgotPassword(ForgotPasswordModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }


            var user =
                await _userManager.FindByEmailAsync(model.Email);


            if (user != null)
            {
                var token =
                    await _userManager.GeneratePasswordResetTokenAsync(user);


                var encodedToken =
                    WebEncoders.Base64UrlEncode(
                        Encoding.UTF8.GetBytes(token)
                    );


                var resetUrl =
                    Url.Action(
                        "ResetPassword",
                        "Auth",
                        new
                        {
                            email = user.Email,
                            token = encodedToken
                        },
                        Request.Scheme
                    );


                await _emailSender.SendEmailAsync(
                    user.Email!,
                    "Reset your Aumo Finance password",
                    EmailTemplates.PasswordReset(
                        user.FullName,
                        resetUrl!
                    )
                );
            }


            TempData["SuccessMessage"] =
                "If that email is registered, a password reset link has been sent.";


            return RedirectToAction("Login");
        }



        // GET: /Auth/ResetPassword
        [HttpGet]
        [AllowAnonymous]
        public IActionResult ResetPassword(
            string email,
            string token)
        {
            return View(
                new ResetPasswordModel
                {
                    Email = email ?? string.Empty,
                    Token = token ?? string.Empty
                }
            );
        }



        // POST: /Auth/ResetPassword
        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ResetPassword(
            ResetPasswordModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }


            var user =
                await _userManager.FindByEmailAsync(model.Email);


            if (user == null)
            {
                ModelState.AddModelError(
                    string.Empty,
                    "This reset link is invalid or has expired."
                );

                return View(model);
            }


            string decodedToken;


            try
            {
                decodedToken =
                    Encoding.UTF8.GetString(
                        WebEncoders.Base64UrlDecode(
                            model.Token
                        )
                    );
            }
            catch (FormatException)
            {
                ModelState.AddModelError(
                    string.Empty,
                    "This reset link is invalid or has expired."
                );

                return View(model);
            }


            var result =
                await _userManager.ResetPasswordAsync(
                    user,
                    decodedToken,
                    model.NewPassword
                );


            if (!result.Succeeded)
            {
                foreach (var error in result.Errors)
                {
                    ModelState.AddModelError(
                        string.Empty,
                        error.Description
                    );
                }

                return View(model);
            }


            TempData["SuccessMessage"] =
                "Password changed successfully. Please sign in with your new password.";


            return RedirectToAction("Login");
        }



        // GET: /Auth/VerifyEmail
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> VerifyEmail(
            string email,
            string token)
        {
            var user =
                string.IsNullOrEmpty(email)
                    ? null
                    : await _userManager.FindByEmailAsync(email);


            if (user == null || string.IsNullOrEmpty(token))
            {
                ViewBag.Success = false;
                ViewBag.Message =
                    "This verification link is invalid.";

                return View();
            }


            try
            {
                var decodedToken =
                    Encoding.UTF8.GetString(
                        WebEncoders.Base64UrlDecode(token)
                    );


                var result =
                    await _userManager.ConfirmEmailAsync(
                        user,
                        decodedToken
                    );


                ViewBag.Success =
                    result.Succeeded;


                ViewBag.Message =
                    result.Succeeded
                        ? "Your email has been successfully verified!"
                        : "This verification link is invalid or has expired.";
            }
            catch (FormatException)
            {
                ViewBag.Success = false;

                ViewBag.Message =
                    "This verification link is invalid.";
            }


            return View();
        }



        // GET: /Auth/ResendVerification
        [HttpGet]
        [AllowAnonymous]
        public IActionResult ResendVerification()
        {
            return View(
                new ResendVerificationModel()
            );
        }



        // POST: /Auth/ResendVerification
        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ResendVerification(
            ResendVerificationModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }


            var normalizedEmail =
                model.Email
                .Trim()
                .ToLowerInvariant();


            var cacheKey =
                $"resend-verification-cooldown:{normalizedEmail}";


            if (!_cache.TryGetValue(cacheKey, out _))
            {
                var user =
                    await _userManager.FindByEmailAsync(
                        model.Email
                    );


                if (user != null &&
                    !await _userManager.IsEmailConfirmedAsync(user))
                {
                    await SendEmailConfirmationAsync(user);
                }


                _cache.Set(
                    cacheKey,
                    true,
                    ResendCooldown
                );
            }


            TempData["SuccessMessage"] =
                "If that email is registered and not yet verified, a new link has been sent.";


            return RedirectToAction("Login");
        }



        private async Task SendEmailConfirmationAsync(
            ApplicationUser user)
        {
            var token =
                await _userManager.GenerateEmailConfirmationTokenAsync(
                    user
                );


            var encodedToken =
                WebEncoders.Base64UrlEncode(
                    Encoding.UTF8.GetBytes(token)
                );


            var confirmUrl =
                Url.Action(
                    "VerifyEmail",
                    "Auth",
                    new
                    {
                        email = user.Email,
                        token = encodedToken
                    },
                    Request.Scheme
                );


            await _emailSender.SendEmailAsync(
                user.Email!,
                "Confirm your Aumo Finance account",
                EmailTemplates.EmailConfirmation(
                    user.FullName,
                    confirmUrl!
                )
            );
        }
    }
}
        
