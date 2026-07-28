using AumoFinance.Models;
using AumoFinance.Services.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers;

[Authorize]
public class GuardianController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IGuardianService _guardianService;


    public GuardianController(
        UserManager<ApplicationUser> userManager,
        IGuardianService guardianService)
    {
        _userManager = userManager;
        _guardianService = guardianService;
    }



    // GET: /Guardian
    public async Task<IActionResult> Index()
    {
        var user =
            await _userManager.GetUserAsync(User);


        if (user == null)
        {
            return RedirectToAction(
                "Login",
                "Auth"
            );
        }


        var sessions =
            await _guardianService
            .GetActiveSessionsAsync(user.Id);


        var activities =
            await _guardianService
            .GetLoginActivitiesAsync(user.Id);


        var model = new GuardianViewModel
        {
            Sessions = sessions,
            Activities = activities
        };


        return View(model);
    }



    // POST: /Guardian/RevokeSession
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RevokeSession(Guid id)
    {
        var user =
            await _userManager.GetUserAsync(User);


        if (user == null)
        {
            return Unauthorized();
        }


        await _guardianService.RevokeSessionAsync(
            id,
            user.Id
        );


        TempData["SuccessMessage"] =
            "Device session has been signed out.";


        return RedirectToAction(
            nameof(Index)
        );
    }
}
