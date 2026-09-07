namespace AumoFinance.Services
{
    public interface IMarketService
    {
        Task<MarketDataResponse> GetMarketDataAsync();
    }

    public class MarketDataResponse
    {
        public bool Success { get; set; }
        public MarketDetail? Usd { get; set; }
        public MarketDetail? Ihsg { get; set; }
        public string? BiRate { get; set; }
    }

    public class MarketDetail
    {
        public double Price { get; set; }
        public double Percent { get; set; }
        public bool IsUp { get; set; }
    }
}
