using OpenAI.Chat;

namespace AumoFinance.Services
{
    public interface IAiService
    {
        Task<string> AnalyzeFinancialQueryAsync(string userPrompt, string contextData = "");
    }

    public class AiService : IAiService
    {
        private readonly string _apiKey;
        private readonly ILogger<AiService> _logger;

        public AiService(IConfiguration configuration, ILogger<AiService> logger)
        {
            _apiKey = configuration["OpenAI:ApiKey"] ?? string.Empty;
            _logger = logger;
        }

        public async Task<string> AnalyzeFinancialQueryAsync(string userPrompt, string contextData = "")
        {
            if (string.IsNullOrWhiteSpace(_apiKey))
            {
                _logger.LogWarning("OpenAI API Key is not configured.");
                return "AI Service is currently offline. Please configure the OpenAI API key.";
            }

            try
            {
                // Menggunakan model gpt-4o-mini (cepat, hemat biaya, dan sangat cerdas untuk analisis data)
                ChatClient client = new(model: "gpt-4o-mini", apiKey: _apiKey);

                // System Prompt: Menjamin AI bertindak tegas, rasional, profesional, dan dalam US English
                string systemInstruction = @"You are the resident AI Financial Controller for Aumo Finance.
Analyse accounting and financial queries with precision, discipline, and absolute accuracy.
Provide concise, actionable insights in professional US English. 
Do not make assumptions beyond rational economic logic.";

                string fullPrompt = string.IsNullOrWhiteSpace(contextData) 
                    ? userPrompt 
                    : $"Context Financial Data:\n{contextData}\n\nUser Question: {userPrompt}";

                List<ChatMessage> messages = new()
                {
                    new SystemChatMessage(systemInstruction),
                    new UserChatMessage(fullPrompt)
                };

                ChatCompletion completion = await client.CompleteChatAsync(messages);
                return completion.Content[0].Text;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling OpenAI API.");
                return "Unable to generate AI analysis at this moment. Please try again later.";
            }
        }
    }
}
