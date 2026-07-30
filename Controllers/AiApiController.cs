using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;
using AumoFinance.Services;

namespace AumoFinance.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/ai")]
public class AiApiController : ControllerBase
{
    private readonly IAiService _aiService;
    private readonly AppDbContext _db;

    public AiApiController(IAiService aiService, AppDbContext db)
    {
        _aiService = aiService;
        _db = db;
    }

    // 1. LIVE SUMMARY ENDPOINT (Automated prompt generated on load)
    [HttpGet("quick-summary")]
    public async Task<IActionResult> GetQuickSummary()
    {
        try
        {
            var context = await GatherFinancialContextAsync();
            var prompt = "Give a concise 1-sentence executive summary of the current financial health based on cash balance, active period, and net income.";
            
            // Generate live summary using LLM Service
            string summary = await _aiService.AnalyzeFinancialQueryAsync(prompt, context.FullContextString);

            return Ok(new { summary });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { summary = "Failed to compile automated summary.", error = ex.Message });
        }
    }

    // 2. INTERACTIVE CHAT ENDPOINT (Connected to IAiService / LLM)
    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] AiChatRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new { reply = "Prompt cannot be empty." });
        }

        try
        {
            var context = await GatherFinancialContextAsync();

            // Send financial context + user question to OpenAI/LLM Service
            string aiResponse = await _aiService.AnalyzeFinancialQueryAsync(request.Message, context.FullContextString);

            return Ok(new { reply = aiResponse });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { reply = "An internal error occurred while generating the AI response.", error = ex.Message });
        }
    }

    // Helper: Collects detailed real-time accounting data from DB
    private async Task<FinancialContextData> GatherFinancialContextAsync()
    {
        var activePeriod = await _db.Periods
            .Where(p => !p.IsClosed)
            .OrderByDescending(p => p.StartDate)
            .FirstOrDefaultAsync();

        string periodInfo = activePeriod != null
            ? $"{activePeriod.PeriodName} ({activePeriod.StartDate:dd MMM yyyy} - {activePeriod.EndDate:dd MMM yyyy})"
            : "All-Time / No Active Period";

        var accounts = await _db.ChartOfAccounts.Where(a => a.IsActive).ToListAsync();
        var lines = await _db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry != null)
            .ToListAsync();

        var accountBalances = new Dictionary<int, decimal>();
        foreach (var account in accounts)
        {
            var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);
            var accountLines = lines.Where(l => l.AccountId == account.Id);
            var net = normalDebit
                ? accountLines.Sum(l => l.Debit - l.Credit)
                : accountLines.Sum(l => l.Credit - l.Debit);
            accountBalances[account.Id] = net;
        }

        var totalCash = accounts
            .Where(a => a.Role == "CashAndEquivalents")
            .Sum(a => accountBalances.GetValueOrDefault(a.Id));

        var totalAssets = accounts
            .Where(a => a.Type == "Assets")
            .Sum(a => accountBalances.GetValueOrDefault(a.Id));

        var totalLiabilities = accounts
            .Where(a => a.Type == "Liabilities")
            .Sum(a => accountBalances.GetValueOrDefault(a.Id));

        IEnumerable<JournalEntryLine> periodLines = lines;
        if (activePeriod != null)
        {
            periodLines = lines.Where(l =>
                l.JournalEntry!.EntryDate >= activePeriod.StartDate &&
                l.JournalEntry!.EntryDate <= activePeriod.EndDate);
        }

        decimal SumByType(string type)
        {
            var ids = accounts.Where(a => a.Type == type).Select(a => a.Id).ToHashSet();
            var normalDebit = AccountClassification.NormalBalanceIsDebit(type);
            var relevant = periodLines.Where(l => ids.Contains(l.AccountId));
            return normalDebit
                ? relevant.Sum(l => l.Debit - l.Credit)
                : relevant.Sum(l => l.Credit - l.Debit);
        }

        var revenue = SumByType("OperatingIncome") + SumByType("OtherIncome");
        var expenses = SumByType("OperatingExpenses") + SumByType("OtherExpenses");
        var netIncome = revenue - expenses;

        var recentJournals = await _db.JournalEntries
            .OrderByDescending(j => j.EntryDate)
            .ThenByDescending(j => j.Id)
            .Take(5)
            .Select(j => new
            {
                Date = j.EntryDate,
                TotalDebit = j.Lines.Sum(l => l.Debit),
                TotalCredit = j.Lines.Sum(l => l.Credit)
            })
            .ToListAsync();

        string journalSummary = recentJournals.Any()
            ? string.Join("\n", recentJournals.Select(j => $"- [{j.Date:dd MMM yyyy}] Debit: IDR {j.TotalDebit:N0} | Credit: IDR {j.TotalCredit:N0}"))
            : "No recent journal entries found.";

        string fullContext = $@"
Financial Context (Aumo Finance System):
- Active Period: {periodInfo}
- Cash & Equivalents: IDR {totalCash:N2}
- Total Assets: IDR {totalAssets:N2}
- Total Liabilities: IDR {totalLiabilities:N2}
- Revenue (Active Period): IDR {revenue:N2}
- Operating Expenses (Active Period): IDR {expenses:N2}
- Net Income (Active Period): IDR {netIncome:N2}

Recent 5 Journal Entries:
{journalSummary}";

        return new FinancialContextData
        {
            TotalCash = totalCash,
            Revenue = revenue,
            Expenses = expenses,
            NetIncome = netIncome,
            PeriodName = periodInfo,
            FullContextString = fullContext
        };
    }
}

public class AiChatRequest
{
    public string Message { get; set; } = string.Empty;
}

public class FinancialContextData
{
    public decimal TotalCash { get; set; }
    public decimal Revenue { get; set; }
    public decimal Expenses { get; set; }
    public decimal NetIncome { get; set; }
    public string PeriodName { get; set; } = string.Empty;
    public string FullContextString { get; set; } = string.Empty;
}
