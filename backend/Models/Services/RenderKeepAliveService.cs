using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AumoFinance.Services;

public class RenderKeepAliveService : BackgroundService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<RenderKeepAliveService> _logger;
    private readonly IConfiguration _configuration;

    public RenderKeepAliveService(
        IHttpClientFactory httpClientFactory,
        ILogger<RenderKeepAliveService> logger,
        IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        // =====================================
        // Initial startup delay
        // =====================================

        try
        {
            await Task.Delay(
                TimeSpan.FromSeconds(15),
                stoppingToken
            );
        }
        catch (OperationCanceledException)
        {
            return;
        }

        // =====================================
        // Determine application URL
        // =====================================
        //
        // Priority:
        // 1. AppUrl configuration
        // 2. RENDER_EXTERNAL_URL
        // 3. Production fallback
        //

        var appUrl = _configuration["AppUrl"];

        if (string.IsNullOrWhiteSpace(appUrl))
        {
            appUrl = Environment.GetEnvironmentVariable(
                "RENDER_EXTERNAL_URL"
            );
        }

        if (string.IsNullOrWhiteSpace(appUrl))
        {
            appUrl = "https://aumo.onrender.com";
        }

        var healthUrl =
            $"{appUrl.TrimEnd('/')}/health";

        _logger.LogInformation(
            "Render Keep-Alive initialized. Target: {HealthUrl}",
            healthUrl
        );

        // =====================================
        // Keep-Alive Loop
        // =====================================

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var client =
                    _httpClientFactory.CreateClient();

                using var response =
                    await client.GetAsync(
                        healthUrl,
                        stoppingToken
                    );

                _logger.LogInformation(
                    "Render Keep-Alive ping sent to {Url}. Status: {StatusCode}",
                    healthUrl,
                    (int)response.StatusCode
                );
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Render Keep-Alive ping failed for {Url}.",
                    healthUrl
                );
            }

            // =================================
            // Ping every 5 minutes
            // =================================

            try
            {
                await Task.Delay(
                    TimeSpan.FromMinutes(5),
                    stoppingToken
                );
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation(
            "Render Keep-Alive service stopped."
        );
    }
}
