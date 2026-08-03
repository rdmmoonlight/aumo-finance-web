using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace AumoFinance.Controllers
{
    [AllowAnonymous] // Mengizinkan akses publik tanpa auth/login
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
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Clear();
                client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

                // 1. Fetch USD/IDR
                var (usdPrice, usdPercent, usdIsUp) = await FetchYahooDataAsync(client, "https://query1.finance.yahoo.com/v8/finance/chart/IDR=X?interval=1d");

                // 2. Fetch IHSG (^JKSE)
                var (ihsgPrice, ihsgPercent, ihsgIsUp) = await FetchYahooDataAsync(client, "https://query1.finance.yahoo.com/v8/finance/chart/^JKSE?interval=1d");

                // 3. BI-Rate
                string biRateVal = "6.00%";

                return Json(new
                {
                    success = true,
                    usd = new { price = usdPrice, percent = usdPercent, isUp = usdIsUp },
                    ihsg = new { price = ihsgPrice, percent = ihsgPercent, isUp = ihsgIsUp },
                    biRate = biRateVal
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saat mengambil data pasar.");
                
                // Return fallback JSON jika terjadi kegagalan fatal
                return Json(new
                {
                    success = false,
                    usd = new { price = 0.0, percent = 0.0, isUp = true },
                    ihsg = new { price = 0.0, percent = 0.0, isUp = true },
                    biRate = "6.00%"
                });
            }
        }

        private async Task<(double price, double percent, bool isUp)> FetchYahooDataAsync(HttpClient client, string url)
        {
            try
            {
                var response = await client.GetFromJsonAsync<YahooResponse>(url);
                var meta = response?.Chart?.Result?.FirstOrDefault()?.Meta;

                if (meta == null) return (0, 0, true);

                double price = meta.RegularMarketPrice;
                double prev = meta.ChartPreviousClose != 0 ? meta.ChartPreviousClose : price;
                double diff = price - prev;
                double percent = prev != 0 ? (diff / prev) * 100 : 0;

                return (Math.Round(price, 2), Math.Round(percent, 2), diff >= 0);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gagal mengambil data dari Yahoo Finance: {Url}", url);
                return (0, 0, true);
            }
        }
    }

    // DTO Helper
    public class YahooResponse
    {
        [JsonPropertyName("chart")]
        public ChartData? Chart { get; set; }
    }

    public class ChartData
    {
        [JsonPropertyName("result")]
        public List<ChartResult>? Result { get; set; }
    }

    public class ChartResult
    {
        [JsonPropertyName("meta")]
        public ChartMeta? Meta { get; set; }
    }

    public class ChartMeta
    {
        [JsonPropertyName("regularMarketPrice")]
        public double RegularMarketPrice { get; set; }

        [JsonPropertyName("chartPreviousClose")]
        public double ChartPreviousClose { get; set; }
    }
}
