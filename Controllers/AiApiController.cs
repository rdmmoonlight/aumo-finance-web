using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using AumoFinance.Models;

namespace AumoFinance.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/ai")]
public class AiApiController : ControllerBase
{
    private readonly IChatClient _chatClient;
    private readonly AppDbContext _db;

    public AiApiController(IChatClient chatClient, AppDbContext db)
    {
        _chatClient = chatClient;
        _db = db;
    }

    // 1. LIVE SUMMARY ENDPOINT (Otomatis dibuat oleh LLM saat halaman dibuka)
    [HttpGet("quick-summary")]
    public async Task<IActionResult> GetQuickSummary()
    {
        try
        {
            var financialData = await GatherFinancialContextAsync();

            var messages = new List<ChatMessage>
            {
                new(ChatRole.System, GetSystemInstruction()),
                new(ChatRole.User, $"Here is the current real-time financial context:\n{financialData.FullContextString}\n\nTask: Provide a concise, professional, 1-to-2 sentence executive summary of the current financial health for the user.")
            };

            ChatResponse response = await _chatClient.GetResponseAsync(messages);

            return Ok(new { summary = response.Message.Text });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { summary = "Failed to compile automated summary.", error = ex.Message });
        }
    }

    // 2. INTERACTIVE CHAT ENDPOINT (Tanya-jawab fleksibel berbasis LLM + Context DB)
    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] AiChatRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new { reply = "Prompt cannot be empty." });
        }

        try
        {
            var financialData = await GatherFinancialContextAsync();

            var messages = new List<ChatMessage>
            {
                new(ChatRole.System, GetSystemInstruction()),
                new(ChatRole.User, $"[REAL-TIME FINANCIAL CONTEXT]\n{financialData.FullContextString}\n\n[USER QUESTION]\n{request.Message}")
            };

            ChatResponse response = await _chatClient.GetResponseAsync(messages);

            return Ok(new { reply = response.Message.Text });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { reply = "An internal error occurred while generating the AI response.", error = ex.Message });
        }
    }

    private string GetSystemInstruction()
    {
        return @"You are an expert AI Financial Assistant for Aumo Finance.
Your task is to answer user queries accurately based strictly on the provided real-time financial context.
Guidelines:
1. Always use US Dollars ($) or the currency specified in the context when mentioning amounts.
2. Be concise, objective, clear, and professional in your analysis.
3. Highlight risks (e.g., negative cash flow, overspending) or positive trends when relevant.
4. If asked for recommendations, provide pragmatic and actionable accounting advice.";
    }

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
            ? string.Join("\n", recentJournals.Select(j => $"- [{j.Date:dd MMM yyyy}] Debit: ${j.TotalDebit:N2} | Credit: ${j.TotalCredit:N2}"))
            : "No recent journal entries found.";

        string fullContext = $@"
Financial Context (Aumo Finance System):
- Active Period: {periodInfo}
- Cash & Equivalents: ${totalCash:N2}
- Total Assets: ${totalAssets:N2}
- Total Liabilities: ${totalLiabilities:N2}
- Revenue (Active Period): ${revenue:N2}
- Operating Expenses (Active Period): ${expenses:N2}
- Net Income (Active Period): ${netIncome:N2}

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