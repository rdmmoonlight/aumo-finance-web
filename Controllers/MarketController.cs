using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Json;

namespace AumoFinance.Controllers
{
    public class MarketController : Controller
    {
        private static readonly HttpClient _httpClient = new HttpClient();

        [HttpGet]
        public async Task<IActionResult> GetMarketData()
        {
            try
            {
                // Set User-Agent agar tidak diblokir Yahoo Finance di level Server
                _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

                // 1. Fetch USD/IDR
                var usdRes = await _httpClient.GetFromJsonAsync<YahooResponse>("https://query1.finance.yahoo.com/v8/finance/chart/IDR=X?interval=1d");
                var usdMeta = usdRes?.Chart?.Result?.FirstOrDefault()?.Meta;

                // 2. Fetch IHSG (^JKSE)
                var ihsgRes = await _httpClient.GetFromJsonAsync<YahooResponse>("https://query1.finance.yahoo.com/v8/finance/chart/^JKSE?interval=1d");
                var ihsgMeta = ihsgRes?.Chart?.Result?.FirstOrDefault()?.Meta;

                // Calculate USD
                double usdPrice = usdMeta?.RegularMarketPrice ?? 0;
                double usdPrev = usdMeta?.ChartPreviousClose ?? usdPrice;
                double usdDiff = usdPrice - usdPrev;
                double usdPercent = usdPrev != 0 ? (usdDiff / usdPrev) * 100 : 0;

                // Calculate IHSG
                double ihsgPrice = ihsgMeta?.RegularMarketPrice ?? 0;
                double ihsgPrev = ihsgMeta?.ChartPreviousClose ?? ihsgPrice;
                double ihsgDiff = ihsgPrice - ihsgPrev;
                double ihsgPercent = ihsgPrev != 0 ? (ihsgDiff / ihsgPrev) * 100 : 0;

                return Json(new
                {
                    success = true,
                    usd = new { price = usdPrice, percent = usdPercent, isUp = usdDiff >= 0 },
                    ihsg = new { price = ihsgPrice, percent = ihsgPercent, isUp = ihsgDiff >= 0 }
                });
            }
            catch
            {
                return Json(new { success = false });
            }
        }
    }

    // Helper Models DTO
    public class YahooResponse { public ChartData? Chart { get; set; } }
    public class ChartData { public List<ChartResult>? Result { get; set; } }
    public class ChartResult { public ChartMeta? Meta { get; set; } }
    public class ChartMeta
    {
        public double RegularMarketPrice { get; set; }
        public double ChartPreviousClose { get; set; }
    }
}
