using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public partial class ReportsController : Controller
    {
        private readonly AppDbContext _db;

        public ReportsController(AppDbContext db)
        {
            _db = db;
        }

        private async Task<(Guid UserId, Period? Period)> GetReportContextAsync()
        {
            var userId = this.CurrentUserId();
            var period = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
            return (userId, period);
        }

        // ==========================================================
        // GENERAL LEDGER
        // ==========================================================

        public async Task<IActionResult> GeneralLedger()
        {
            ViewData["Title"] = "General Ledger";
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View(new List<LedgerAccountViewModel>());
            }
            ViewBag.SelectedPeriod = period;

            var ledgers = await BuildLedgersAsync(userId, period, AccountClassification.IsPermanent);
            return View(ledgers);
        }

        public async Task<IActionResult> GeneralLedgerTemporary()
        {
            ViewData["Title"] = "General Ledger (Temporary Accounts)";
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View(new List<LedgerAccountViewModel>());
            }
            ViewBag.SelectedPeriod = period;

            var ledgers = await BuildLedgersAsync(userId, period, AccountClassification.IsTemporary);
            return View(ledgers);
        }

        private async Task<List<LedgerAccountViewModel>> BuildLedgersAsync(Guid userId, Period period, Func<string, bool> typeFilter)
        {
            var accounts = (await _db.ChartOfAccounts
                    .Where(a => a.IsActive && a.UserId == userId)
                    .OrderBy(a => a.ReferenceNumber)
                    .ToListAsync())
                .Where(a => typeFilter(a.Type))
                .ToList();

            var accountIds = accounts.Select(a => a.Id).ToList();

            var lines = await _db.JournalEntryLines
                .Include(l => l.JournalEntry)
                .Where(l => accountIds.Contains(l.AccountId) && l.JournalEntry!.UserId == userId)
                .OrderBy(l => l.JournalEntry!.EntryDate)
                .ThenBy(l => l.JournalEntry!.Id)
                .ThenBy(l => l.LineOrder)
                .ToListAsync();

            var result = new List<LedgerAccountViewModel>();

            foreach (var account in accounts)
            {
                var isPermanent = AccountClassification.IsPermanent(account.Type);
                var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);
                decimal running = 0;

                var accountLines = isPermanent
                    ? lines.Where(l => l.AccountId == account.Id && l.JournalEntry!.EntryDate <= period.EndDate)
                    : lines.Where(l => l.AccountId == account.Id && l.JournalEntry!.EntryDate >= period.StartDate && l.JournalEntry!.EntryDate <= period.EndDate);

                var ledgerLines = new List<LedgerLineViewModel>();
                foreach (var line in accountLines)
                {
                    running += normalDebit ? (line.Debit - line.Credit) : (line.Credit - line.Debit);
                    ledgerLines.Add(new LedgerLineViewModel
                    {
                        EntryDate = line.JournalEntry!.EntryDate,
                        Description = line.LineDescription,
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
