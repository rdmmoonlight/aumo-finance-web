using AumoFinance.Models; // Sesuaikan namespace AppDbContext & Model transaksi kamu
using AumoFinance.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AumoFinance.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/ai")]
    public class AiApiController : ControllerBase
    {
        private readonly IAiService _aiService;
        private readonly AppDbContext _dbContext;

        public AiApiController(IAiService aiService, AppDbContext dbContext)
        {
            _aiService = aiService;
            _dbContext = dbContext;
        }

        [HttpPost("analyze")]
        public async Task<IActionResult> Analyze([FromBody] AiRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Prompt))
            {
                return BadRequest(new { message = "Prompt cannot be empty." });
            }

            // 1. Ambil ID user yang sedang login (opsional jika data bersifat per-user)
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            // 2. Tarik data keuangan riil dari database (contoh perhitungan bulan berjalan)
            var now = DateTime.UtcNow;
            var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

            // Ganti nama DbSet & property berikut sesuai schema EF Core di proyekmu:
            // Contoh asumsi: _dbContext.Transactions (Amount, Type ['Inflow'/'Outflow'], Date, Category)
            
            var monthlyInflow = await _dbContext.Transactions
                .Where(t => t.Type == "Inflow" && t.Date >= startOfMonth)
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;

            var monthlyOutflow = await _dbContext.Transactions
                .Where(t => t.Type == "Outflow" && t.Date >= startOfMonth)
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;

            var totalBalance = await _dbContext.Accounts
                .SumAsync(a => (decimal?)a.Balance) ?? 0m;

            // Ambil 5 transaksi terakhir untuk memberikan gambaran aktivitas riil ke AI
            var recentTransactions = await _dbContext.Transactions
                .OrderByDescending(t => t.Date)
                .Take(5)
                .Select(t => $"- [{t.Date:yyyy-MM-dd}] {t.Type}: ${t.Amount:N2} ({t.Category ?? "General"})")
                .ToListAsync();

            string recentTxText = recentTransactions.Any() 
                ? string.Join("\n", recentTransactions) 
                : "No recent transactions found.";

            // 3. Format contextData secara rapi dan rasional
            string contextData = $@"
Financial Context as of {now:MMMM yyyy}:
- Total Liquid Cash / Bank Balance: ${totalBalance:N2}
- Total Inflow This Month: ${monthlyInflow:N2}
- Total Outflow This Month: ${monthlyOutflow:N2}
- Net Monthly Cashflow: ${(monthlyInflow - monthlyOutflow):N2}

Recent 5 Transactions:
{recentTxText}";

            // 4. Kirim prompt + data konteks riil dari DB ke OpenAI
            string aiResponse = await _aiService.AnalyzeFinancialQueryAsync(request.Prompt, contextData);

            return Ok(new { response = aiResponse });
        }
    }

    public class AiRequestDto
    {
        public string Prompt { get; set; } = string.Empty;
    }
}
