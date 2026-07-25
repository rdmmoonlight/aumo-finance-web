using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public class ReportsController : Controller
    {
        private readonly AppDbContext _db;

        public ReportsController(AppDbContext db)
        {
            _db = db;
        }

        // General Ledger: akun riil / permanen (Assets, Liabilities, Equity).
        public async Task<IActionResult> GeneralLedger()
        {
            ViewData["Title"] = "General Ledger";
            var ledgers = await BuildLedgersAsync(AccountClassification.IsPermanent);
            return View(ledgers);
        }

        // General Ledger (Temporary Accounts): akun nominal / sementara
        // (Operating Income, Operating Expenses, Other Income, Other
        // Expenses) yang ditutup ke Equity pada akhir periode.
        public async Task<IActionResult> GeneralLedgerTemporary()
        {
            ViewData["Title"] = "General Ledger (Temporary Accounts)";
            var ledgers = await BuildLedgersAsync(AccountClassification.IsTemporary);
            return View(ledgers);
        }

        private async Task<List<LedgerAccountViewModel>> BuildLedgersAsync(Func<string, bool> typeFilter)
        {
            var accounts = (await _db.ChartOfAccounts
                    .Where(a => a.IsActive)
                    .OrderBy(a => a.ReferenceNumber)
                    .ToListAsync())
                .Where(a => typeFilter(a.Type))
                .ToList();

            var accountIds = accounts.Select(a => a.Id).ToList();

            // Setiap baris ledger berasal langsung dari JournalEntryLine yang
            // sama dengan yang tampil di General Journal — satu sumber data,
            // tidak ada duplikasi input.
            var lines = await _db.JournalEntryLines
                .Include(l => l.JournalEntry)
                .Where(l => accountIds.Contains(l.AccountId))
                .OrderBy(l => l.JournalEntry!.EntryDate)
                .ThenBy(l => l.JournalEntry!.Id)
                .ThenBy(l => l.LineOrder)
                .ToListAsync();

            var result = new List<LedgerAccountViewModel>();

            foreach (var account in accounts)
            {
                var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);
                decimal running = 0;

                var ledgerLines = new List<LedgerLineViewModel>();
                foreach (var line in lines.Where(l => l.AccountId == account.Id))
                {
                    running += normalDebit ? (line.Debit - line.Credit) : (line.Credit - line.Debit);
                    ledgerLines.Add(new LedgerLineViewModel
                    {
                        EntryDate = line.JournalEntry!.EntryDate,
                        ReferenceNumber = line.JournalEntry!.ReferenceNumber,
                        Description = line.LineDescription ?? line.JournalEntry!.Memo,
                        Debit = line.Debit,
                        Credit = line.Credit,
                        RunningBalance = running
                    });
                }

                result.Add(new LedgerAccountViewModel
                {
                    AccountId = account.Id,
                    ReferenceNumber = account.ReferenceNumber,
                    AccountName = account.AccountName,
                    Type = account.Type,
                    NormalBalanceIsDebit = normalDebit,
                    Lines = ledgerLines,
                    EndingBalance = running
                });
            }

            return result;
        }
    }
}
