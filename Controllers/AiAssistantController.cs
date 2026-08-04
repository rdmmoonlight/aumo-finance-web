using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;
using AumoFinance.Services;

namespace AumoFinance.Controllers
{
    public class ChatRequestDto
    {
        public string Message { get; set; } = string.Empty;
    }

    [Authorize]
    public class AiAssistantController : Controller
    {
        private readonly AppDbContext _db;
        private readonly IAiService _aiService;

        public AiAssistantController(AppDbContext db, IAiService aiService)
        {
            _db = db;
            _aiService = aiService;
        }

        // Merender halaman Razor View (GET /ai)
        [HttpGet("ai")]
        public IActionResult Index()
        {
            return View();
        }

        // Endpoint API quick-summary (GET /api/ai/quick-summary)
        [HttpGet("api/ai/quick-summary")]
        public async Task<IActionResult> GetQuickSummary()
        {
            var context = await BuildFinancialContextAsync();

            var summary = await _aiService.AnalyzeFinancialQueryAsync(
                "Give a one-paragraph, max 3-sentence live summary of the current cash flow and financial condition based on the data provided.",
                context);

            return Ok(new { summary });
        }

        // Endpoint API chat (POST /api/ai/chat)
        [HttpPost("api/ai/chat")]
        public async Task<IActionResult> Chat([FromBody] ChatRequestDto request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { reply = "Message cannot be empty." });
            }

            var context = await BuildFinancialContextAsync();
            var reply = await _aiService.AnalyzeFinancialQueryAsync(request.Message, context);

            return Ok(new { reply });
        }

        // Menyusun ringkasan data keuangan sebagai konteks untuk AI — dibatasi
        // ke data milik user yang sedang login, dan ke periode yang sedang
        // di-view (konsisten dengan Dashboard/Reports).
        private async Task<string> BuildFinancialContextAsync()
        {
            var userId = this.CurrentUserId();
            var activePeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);

            if (activePeriod == null)
            {
                return "No period is currently selected. Ask the user to pick a period on the Periods page first.";
            }

            var accounts = await _db.ChartOfAccounts
                .Where(a => a.IsActive && a.UserId == userId)
                .ToListAsync();

            var lines = await _db.JournalEntryLines
                .Include(l => l.JournalEntry)
                .Include(l => l.Account)
                .Where(l => l.JournalEntry != null && l.JournalEntry.UserId == userId && l.JournalEntry.EntryDate <= activePeriod.EndDate)
                .ToListAsync();

            if (accounts.Count == 0 || lines.Count == 0)
            {
                return "No journal or account data is available yet.";
            }

            decimal BalanceFor(string type)
            {
                var ids = accounts.Where(a => a.Type == type).Select(a => a.Id).ToHashSet();
                var normalDebit = AccountClassification.NormalBalanceIsDebit(type);
                var relevant = lines.Where(l => ids.Contains(l.AccountId));
                return normalDebit
                    ? relevant.Sum(l => l.Debit - l.Credit)
                    : relevant.Sum(l => l.Credit - l.Debit);
            }

            var cash = accounts.Where(a => a.Role == "CashAndEquivalents")
                .Sum(a => lines.Where(l => l.AccountId == a.Id).Sum(l => l.Debit - l.Credit));

            var revenue = BalanceFor("OperatingIncome") + BalanceFor("OtherIncome");
            var expenses = BalanceFor("OperatingExpenses") + BalanceFor("OtherExpenses");
            var netIncome = revenue - expenses;

            var topExpenses = accounts
                .Where(a => a.Type is "OperatingExpenses" or "OtherExpenses")
                .Select(a => new
                {
                    a.AccountName,
                    Amount = lines.Where(l => l.AccountId == a.Id).Sum(l => l.Debit - l.Credit)
                })
                .Where(x => x.Amount != 0)
                .OrderByDescending(x => x.Amount)
                .Take(5)
                .ToList();

            var idr = new System.Globalization.CultureInfo("id-ID");
            var sb = new System.Text.StringBuilder();
            sb.AppendLine($"Active period: {activePeriod?.PeriodName ?? "None"}");
            sb.AppendLine($"Cash and equivalents: {cash.ToString("N0", idr)}");
            sb.AppendLine($"Revenue: {revenue.ToString("N0", idr)}");
            sb.AppendLine($"Operating expenses: {expenses.ToString("N0", idr)}");
            sb.AppendLine($"Net income: {netIncome.ToString("N0", idr)}");
            sb.AppendLine("Top expense accounts:");
            foreach (var exp in topExpenses)
            {
                sb.AppendLine($"- {exp.AccountName}: {exp.Amount.ToString("N0", idr)}");
            }

            return sb.ToString();
        }
    }
}
