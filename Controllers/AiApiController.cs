using AumoFinance.Models;
using AumoFinance.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

            var now = DateTime.UtcNow;

            // 1. Ambil 5 transaksi jurnal terakhir dari DbSet JournalEntries
            var recentJournals = await _dbContext.JournalEntries
                .OrderByDescending(j => j.Date)
                .Take(5)
                .Select(j => $"- [{j.Date:yyyy-MM-dd}] Ref: {j.ReferenceNumber} | Notes: {j.Description}")
                .ToListAsync();

            string journalSummary = recentJournals.Any()
                ? string.Join("\n", recentJournals)
                : "No recent journal entries found.";

            // 2. Ambil ringkasan akun dari DbSet ChartOfAccounts
            var chartOfAccounts = await _dbContext.ChartOfAccounts
                .Take(10)
                .Select(a => $"- Account: {a.Name} (Ref: {a.ReferenceNumber})")
                .ToListAsync();

            string coaSummary = chartOfAccounts.Any()
                ? string.Join("\n", chartOfAccounts)
                : "No chart of accounts available.";

            // 3. Gabungkan konteks data akuntansi riil dari database Neon PostgreSQL
            string contextData = $@"
Financial Accounting Context as of {now:MMMM yyyy}:

Recent Journal Entries:
{journalSummary}

Chart of Accounts Summary:
{coaSummary}";

            // 4. Minta ChatGPT menganalisis prompt + konteks data
            string aiResponse = await _aiService.AnalyzeFinancialQueryAsync(request.Prompt, contextData);

            return Ok(new { response = aiResponse });
        }
    }

    public class AiRequestDto
    {
        public string Prompt { get; set; } = string.Empty;
    }
}
