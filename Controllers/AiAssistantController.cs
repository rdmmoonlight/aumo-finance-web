using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers
{
    [Authorize]
    public class AiAssistantController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
