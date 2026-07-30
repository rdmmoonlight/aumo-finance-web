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
        private readonly AppDbContext _db;

        public AiApiController(IAiService aiService, AppDbContext db)
        {
            _aiService = aiService;
            _db = db;
        }

        [HttpPost("analyze")]
        public async Task<IActionResult> Analyze([FromBody] AiRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Prompt))
            {
                return BadRequest(new { message = "Prompt cannot be empty." });
            }

            // 1. Ambil Periode Aktif
            var activePeriod = await _db.Periods
                .Where(p => !p.IsClosed)
                .OrderByDescending(p => p.StartDate)
                .FirstOrDefaultAsync();

            string periodInfo = activePeriod != null 
                ? $"{activePeriod.PeriodName} ({activePeriod.StartDate:dd MMM yyyy} - {activePeriod.EndDate:dd MMM yyyy})"
                : "All-Time / No Active Period";

            // 2. Ambil Akun dan Jurnal Lines untuk Kalkulasi
            var accounts = await _db.ChartOfAccounts
                .Where(a => a.IsActive)
                .ToListAsync();

            var lines = await _db.JournalEntryLines
                .Include(l => l.JournalEntry)
                .Where(l => l.JournalEntry != null)
                .ToListAsync();

            // 3. Hitung Net Balance untuk Setiap Akun
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

            // 4. Hitung Nilai KPI Utama
            var totalCash = accounts
                .Where(a => a.Role == "CashAndEquivalents")
                .Sum(a => accountBalances.GetValueOrDefault(a.Id));

            var totalAssets = accounts
                .Where(a => a.Type == "Assets")
                .Sum(a => accountBalances.GetValueOrDefault(a.Id));

            var totalLiabilities = accounts
                .Where(a => a.Type == "Liabilities")
                .Sum(a => accountBalances.GetValueOrDefault(a.Id));

            // 5. Hitung Revenue & Expense untuk Periode Aktif
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

            var revenueThisPeriod = SumByType("OperatingIncome") + SumByType("OtherIncome");
            var operatingExpenses = SumByType("OperatingExpenses") + SumByType("OtherExpenses");
            var netIncome = revenueThisPeriod - operatingExpenses;

            // 6. Ambil 5 Jurnal Transaksi Terakhir (Logika presisi dari DashboardController)
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
                : "No journal entries found.";

            // 7. Format Seluruh Konteks Keuangan Real-Time untuk OpenAI ChatGPT
            string contextData = $@"
Financial Context (Aumo Finance System):
- Active Period: {periodInfo}
- Cash & Equivalents: IDR {totalCash:N0}
- Total Assets: IDR {totalAssets:N0}
- Total Liabilities: IDR {totalLiabilities:N0}
- Revenue (This Period): IDR {revenueThisPeriod:N0}
- Operating Expenses (This Period): IDR {operatingExpenses:N0}
- Net Income (This Period): IDR {netIncome:N0}

Recent 5 Journal Entries:
{journalSummary}";

            // 8. Panggil ChatGPT untuk Melakukan Analisis Akuntansi Presisi
            string aiResponse = await _aiService.AnalyzeFinancialQueryAsync(request.Prompt, contextData);

            return Ok(new { response = aiResponse });
        }
    }

    public class AiRequestDto
    {
        public string Prompt { get; set; } = string.Empty;
    }
}
