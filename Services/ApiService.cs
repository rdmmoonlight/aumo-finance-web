using System.Net.Http.Json;
using AumoFinance.Models;
using Microsoft.Maui.Storage;

namespace AumoFinance.Services;

public class ApiService
{
    // Preset Domain Railway Anda
    public const string UrlProduction = "https://aumo.up.railway.app/api/mobile/";
    public const string UrlPreview = "https://aumo-preview.up.railway.app/api/mobile/";

    // Mengambil URL aktif dari penyimpanan lokal HP (Preferences)
    public static string CurrentBaseUrl
    {
        get => Preferences.Default.Get("api_base_url", UrlProduction);
        set => Preferences.Default.Set("api_base_url", value);
    }

    private HttpClient GetClient()
    {
        var url = CurrentBaseUrl;
        if (!url.EndsWith("/")) url += "/";

        return new HttpClient 
        { 
            BaseAddress = new Uri(url),
            Timeout = TimeSpan.FromSeconds(10)
        };
    }

    public async Task<DashboardModel?> GetDashboardAsync()
    {
        try
        {
            using var http = GetClient();
            return await http.GetFromJsonAsync<DashboardModel>("dashboard");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[API Error] {ex.Message}");
            return null;
        }
    }
}
