using Microsoft.AspNetCore.Authorization; // Tambahkan ini
using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers
{
    [AllowAnonymous] // <-- TAMBAHKAN INI agar tidak kena redirect ke Login
    public class MarketController : Controller
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<MarketController> _logger;

        public MarketController(IHttpClientFactory httpClientFactory, ILogger<MarketController> logger)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetMarketData()
        {
            // ... kode Fetch Data Anda ...
        }
    }
}
