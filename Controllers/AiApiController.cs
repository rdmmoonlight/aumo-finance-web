using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/ai")]
public class AiApiController : ControllerBase
{
    private readonly AppDbContext _db;

    public AiApiController(AppDbContext db)
    {
        _db = db;
    }

    // 1. LIVE SUMMARY ENDPOINT (Auto-generated insight)
    [HttpGet("quick-summary")]
    public async Task<IActionResult> GetQuickSummary()
    {
        try
        {
            var contextData = await GatherFinancialContextAsync();

            string summary;
            if (contextData.TotalCash < 0)
            {
                summary = $"Liquidity Warning: Cash balance is negative (${contextData.TotalCash:N2}). Immediate cash reconciliation or payment hold is recommended.";
            }
            else if (contextData.NetIncome > 0)
            {
                summary = $"Healthy Performance: The {contextData.PeriodName} period generated a net profit of ${contextData.NetIncome:N2} with a total cash reserve of ${contextData.TotalCash:N2}. Operations are stable.";
            }
            else if (contextData.NetIncome < 0)
            {
                summary = $"Deficit Alert: Expenses exceed revenue by ${Math.Abs(contextData.NetIncome):N2} for this period. Review your major expense entries.";
            }
            else
            {
                summary = $"Current Cash Balance is ${contextData.TotalCash:N2}. No significant profit or loss recorded for the active period yet.";
            }

            return Ok(new { summary });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { summary = "Failed to compile automated summary.", error = ex.Message });
        }
    }

    // 2. INTERACTIVE CHAT ENDPOINT
    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] AiChatRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new { reply = "Prompt cannot be empty." });
        }

        try
        {
            var data = await GatherFinancialContextAsync();
            var q = request.Message.ToLower();
            string reply;

            if (q.Contains("cash") || q.Contains("liquidity") || q.Contains("cash flow"))
            {
                reply = $"**Cash Flow Analysis:**\n" +
                        $"- Total Cash & Equivalents: **${data.TotalCash:N2}**\n" +
                        $"- Active Period: **{data.PeriodName}**\n\n" +
                        (data.TotalCash > 0 
                            ? "Your current liquidity is healthy enough to support short-term operational expenses." 
                            : "Attention: Cash reserves are negative. It is advised to restrict non-essential expenditures.");
            }
            else if (q.Contains("spend") || q.Contains("overspend") || q.Contains("expense") || q.Contains("cost"))
            {
                reply = $"**Expense Breakdown ({data.PeriodName}):**\n" +
                        $"- Total Operating Expenses: **${data.Expenses:N2}**\n" +
                        $"- Total Revenue: **${data.Revenue:N2}**\n\n" +
                        (data.Expenses > data.Revenue 
                            ? "⚠️ **Warning:** Total expenses exceed revenue in this period. Consider reviewing the largest expense journal lines." 
                            : "Expense ratios remain well-controlled compared to total incoming revenue.");
            }
            else if (q.Contains("profit") || q.Contains("income") || q.Contains("forecast") || q.Contains("estimate"))
            {
                reply = $"**Profit & Loss Projection ({data.PeriodName}):**\n" +
                        $"- Revenue: ${data.Revenue:N2}\n" +
                        $"- Expenses: ${data.Expenses:N2}\n" +
                        $"-----\n" +
                        $"- **Net Income: ${data.NetIncome:N2}**\n\n" +
                        (data.NetIncome >= 0 
                            ? "Your business is currently operating at a net profit." 
                            : "Your business is currently running an operational deficit (net loss).");
            }
            else if (q.Contains("tip") || q.Contains("efficiency") || q.Contains("optimize") || q.Contains("advice"))
            {
                reply = "**3 Actionable Financial Optimization Tips:**\n" +
                        "1. **Reconcile Pending Entries:** Ensure quick mobile transactions in *Unclassified* accounts are mapped to proper chart of accounts.\n" +
                        "2. **Maintain Emergency Cash Buffer:** Set aside a 15-20% cash reserve from gross revenue for liquidity safety.\n" +
                        "3. **Regular Cost Review:** Regularly audit recurring operating expense lines against revenue growth.";
            }
            else
            {
                reply = $"Thank you for your inquiry. Based on the current system records:\n" +
                        $"- **Total Cash:** ${data.TotalCash:N2}\n" +
                        $"- **Net Income (Period):** ${data.NetIncome:N2}\n\n" +
                        $"Is there a specific metric or report area you would like to drill into?";
            }

            return Ok(new { reply });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { reply = "An internal error occurred while generating the response.", error = ex.Message });
        }
    }

    private async Task<FinancialContextData> GatherFinancialContextAsync()
    {
        var activePeriod = await _db.Periods
            .Where(p => !p.IsClosed)
            .OrderByDescending(p => p.StartDate)
            .FirstOrDefaultAsync();

        var accounts = await _db.ChartOfAccounts.Where(a => a.IsActive).ToListAsync();
        var lines = await _db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry != null)
            .ToListAsync();

        var accountBalances = new Dictionary<int, decimal>();
        foreach (var acc in accounts)
        {
            var isDebit = AccountClassification.NormalBalanceIsDebit(acc.Type);
            var accLines = lines.Where(l => l.AccountId == acc.Id);
            accountBalances[acc.Id] = isDebit
                ? accLines.Sum(l => l.Debit - l.Credit)
                : accLines.Sum(l => l.Credit - l.Debit);
        }

        var totalCash = accounts
            .Where(a => a.Role == "CashAndEquivalents")
            .Sum(a => accountBalances.GetValueOrDefault(a.Id));

        var periodLines = activePeriod != null
            ? lines.Where(l => l.JournalEntry!.EntryDate >= activePeriod.StartDate && l.JournalEntry!.EntryDate <= activePeriod.EndDate)
            : lines;

        decimal SumType(string type)
        {
            var ids = accounts.Where(a => a.Type == type).Select(a => a.Id).ToHashSet();
            var isDebit = AccountClassification.NormalBalanceIsDebit(type);
            var rel = periodLines.Where(l => ids.Contains(l.AccountId));
            return isDebit ? rel.Sum(l => l.Debit - l.Credit) : rel.Sum(l => l.Credit - l.Debit);
        }

        var rev = SumType("OperatingIncome") + SumType("OtherIncome");
        var exp = SumType("OperatingExpenses") + SumType("OtherExpenses");

        return new FinancialContextData
        {
            TotalCash = totalCash,
            Revenue = rev,
            Expenses = exp,
            NetIncome = rev - exp,
            PeriodName = activePeriod?.PeriodName ?? "All Periods"
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
}
