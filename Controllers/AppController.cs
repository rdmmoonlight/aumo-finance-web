namespace AumoFinance.Controllers;

[Authorize]
public class AppController : Controller
{
    private readonly IDashboardService _dashboardService; // Panggil service dashboard yang sama

    public AppController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    // GET: /app/dashboard
    public async Task<IActionResult> Dashboard()
    {
        var model = await _dashboardService.GetDashboardDataAsync();
        return View(model); // Mengembalikan View Views/App/Dashboard.cshtml di atas
    }

    // GET: /app/journal-input
    public IActionResult JournalInput()
    {
        return View(); // Untuk halaman input jurnal kedua
    }
}
