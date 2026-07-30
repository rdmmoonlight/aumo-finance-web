using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers
{
    [Authorize]
    [Route("ai")]
    public class AiAssistantController : Controller
    {
        // Untuk merender halaman Razor View (GET /ai)
        [HttpGet("")]
        public IActionResult Index()
        {
            return View();
        }

        // Untuk endpoint API quick-summary (GET /ai/quick-summary)
        [HttpGet("quick-summary")]
        public async Task<IActionResult> GetQuickSummary()
        {
            // TODO: Implementasikan logika ringkasan AI di sini
            return Ok(new { message = "Quick summary berhasil diambil." });
        }
    }
}
