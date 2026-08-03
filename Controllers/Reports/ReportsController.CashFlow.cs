using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public partial class ReportsController
    {
        // ==========================================================
        // CASH FLOW STATEMENT (Direct Method - IAS 7)
        // ==========================================================

        public async Task<IActionResult> CashFlowStatement()
        {
            ViewData["Title"] = "Cash Flow Statement";
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View(new CashFlowStatementViewModel());
            }
            ViewBag.SelectedPeriod = period;

            var cashAccounts = await _db.ChartOfAccounts
                .Where(a => a.IsActive && a.UserId == userId && a.Role == "CashAndEquivalents")
                .ToListAsync();

            var cashAccountIds = cashAccounts.Select(a => a.Id).ToList();

            if (!cashAccountIds.Any())
            {
                return View(new CashFlowStatementViewModel());
            }

            // 1. Hitung Saldo Awal Kas (sebelum StartDate periode)
            var priorCashLines = await _db.JournalEntryLines
                .Include(l => l.JournalEntry)
                .Where(l => cashAccountIds.Contains(l.AccountId)
                         && l.JournalEntry!.UserId == userId
                         && l.JournalEntry!.EntryDate < period.StartDate)
                .ToListAsync();

            decimal beginningCash = priorCashLines.Sum(l => l.Debit - l.Credit);

            // 2. Ambil transaksi kas periode berjalan (StartDate s.d. EndDate)
            var entryIds = await _db.JournalEntryLines
                .Include(l => l.JournalEntry)
                .Where(l => cashAccountIds.Contains(l.AccountId)
                         && l.JournalEntry!.UserId == userId
                         && l.JournalEntry!.EntryDate >= period.StartDate
                         && l.JournalEntry!.EntryDate <= period.EndDate)
                .Select(l => l.JournalEntryId)
                .Distinct()
                .ToListAsync();

            var entries = await _db.JournalEntries
                .Include(j => j.Lines)
                    .ThenInclude(l => l.Account)
                .Where(j => entryIds.Contains(j.Id))
                .ToListAsync();

            var operating = new Dictionary<string, decimal>();
            var investing = new Dictionary<string, decimal>();
            var financing = new Dictionary<string, decimal>();

            void Add(Dictionary<string, decimal> bucket, string description, decimal amount)
            {
                bucket[description] = bucket.GetValueOrDefault(description) + amount;
            }

            foreach (var entry in entries)
            {
                var cashLines = entry.Lines.Where(l => cashAccountIds.Contains(l.AccountId)).ToList();
                var cashNet = cashLines.Sum(l => l.Debit - l.Credit);
                if (cashNet == 0) continue;

                var contraLines = entry.Lines.Where(l => !cashAccountIds.Contains(l.AccountId)).ToList();
                var contraTotal = contraLines.Sum(l => Math.Abs(l.Debit - l.Credit));
                if (contraTotal == 0) continue;

                foreach (var contra in contraLines)
                {
                    var contraAmount = Math.Abs(contra.Debit - contra.Credit);
                    if (contraAmount == 0) continue;

                    var portion = cashNet * (contraAmount / contraTotal);
                    var type = contra.Account?.Type ?? "";
                    var role = contra.Account?.Role ?? "";
                    var description = contra.Account?.AccountName ?? "Uncategorized";

                    // Klasifikasi berdasarkan standar akuntansi IAS 7
                    if (type == "OperatingIncome" || type == "OperatingExpenses" ||
                        type == "OtherIncome" || type == "OtherExpenses" ||
                        role == "CurrentAsset" || role == "CurrentLiability" ||
                        role == "AccountsReceivable" || role == "AccountsPayable")
                    {
                        Add(operating, description, portion);
                    }
                    else if (type == "Assets" || role == "NonCurrentAsset" || role == "FixedAsset" || role == "Investment")
                    {
                        Add(investing, description, portion);
                    }
                    else if (type == "Equity" || type == "Liabilities" || role == "NonCurrentLiability" || role == "LongTermDebt")
                    {
                        Add(financing, description, portion);
                    }
                    else
                    {
                        Add(operating, description, portion);
                    }
                }
            }

            var vm = new CashFlowStatementViewModel
            {
                BeginningCash = beginningCash,
                OperatingActivities = operating.Select(kv => new CashFlowLine { Description = kv.Key, Amount = kv.Value }).OrderByDescending(l => l.Amount).ToList(),
                InvestingActivities = investing.Select(kv => new CashFlowLine { Description = kv.Key, Amount = kv.Value }).OrderByDescending(l => l.Amount).ToList(),
                FinancingActivities = financing.Select(kv => new CashFlowLine { Description = kv.Key, Amount = kv.Value }).OrderByDescending(l => l.Amount).ToList()
            };

            return View(vm);
        }
    }
}
