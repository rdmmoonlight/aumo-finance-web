using System.Net.Http.Json;
using System.Text.Json;

namespace AumoFinance.Services
{
    public interface IAiService
    {
        Task<string> AnalyzeFinancialQueryAsync(string userPrompt, string contextData = "");
    }

    public class AiService : IAiService
    {
        private readonly HttpClient _httpClient;
        private readonly string _apiKey;
        private readonly ILogger<AiService> _logger;

        // Model Gemini yang cepat dan gratis (dalam batas kuota harian)
        private const string Model = "gemini-2.5-flash";

        public AiService(HttpClient httpClient, IConfiguration configuration, ILogger<AiService> logger)
        {
            _httpClient = httpClient;
            _apiKey = configuration["Gemini:ApiKey"] ?? string.Empty;
            _logger = logger;
        }

        public async Task<string> AnalyzeFinancialQueryAsync(string userPrompt, string contextData = "")
        {
            if (string.IsNullOrWhiteSpace(_apiKey))
            {
                _logger.LogWarning("Gemini API Key is not configured.");
                return "AI Service is currently offline. Please configure the Gemini API key.";
            }

            try
            {
                string systemInstruction = @"You are the resident AI Financial Controller for Aumo Finance.
Analyse accounting and financial queries with precision, discipline, and absolute accuracy.
Provide concise, actionable insights in professional US English.
Do not make assumptions beyond rational economic logic.";

                string fullPrompt = string.IsNullOrWhiteSpace(contextData)
                    ? userPrompt
                    : $"Context Financial Data:\n{contextData}\n\nUser Question: {userPrompt}";

                var requestBody = new
                {
                    system_instruction = new
                    {
                        parts = new[] { new { text = systemInstruction } }
                    },
                    contents = new[]
                    {
                        new
                        {
                            role = "user",
                            parts = new[] { new { text = fullPrompt } }
                        }
                    }
                };

                string url = $"https://generativelanguage.googleapis.com/v1beta/models/{Model}:generateContent?key={_apiKey}";

                using var response = await _httpClient.PostAsJsonAsync(url, requestBody);

                if (!response.IsSuccessStatusCode)
                {
                    string errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Gemini API returned {StatusCode}: {Body}", response.StatusCode, errorBody);
                    return "Unable to generate AI analysis at this moment. Please try again later.";
                }

                using var stream = await response.Content.ReadAsStreamAsync();
                using var doc = await JsonDocument.ParseAsync(stream);

                var text = doc.RootElement
                    .GetProperty("candidates")[0]
                    .GetProperty("content")
                    .GetProperty("parts")[0]
                    .GetProperty("text")
                    .GetString();

                return string.IsNullOrWhiteSpace(text)
                    ? "Unable to generate AI analysis at this moment. Please try again later."
                    : text;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling Gemini API.");
                return "Unable to generate AI analysis at this moment. Please try again later.";
            }
        }
    }
}
