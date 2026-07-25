using Microsoft.AspNetCore.Mvc;
using AumoFinance.Models;
using System;
using System.Collections.Generic;

namespace AumoFinance.Controllers
{
    public class DashboardController : Controller
    {
        public IActionResult Index()
        {
            // TODO: Replace mock data with real EF Core queries against JournalEntries,
            // ChartOfAccounts, and Periods once the data layer is fully connected.

            var model = new DashboardViewModel
            {
                TotalCashAndEquivalents = 142_500_000m,
                RevenueThisPeriod = 58_400_000m,
                OperatingExpenses = 21_150_000m,
                NetIncome = 37_250_000m,
                TotalAssets = 312_800_000m,
                TotalLiabilities = 98_400_000m,

                CashTrendPercent = 4.2m,
                RevenueTrendPercent = 8.7m,
                ExpenseTrendPercent = -3.1m,
                NetIncomeTrendPercent = 12.4m,

                ChartLabels = new List<string> { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul" },
                ChartRevenue = new List<decimal> { 45_000_000, 52_000_000, 48_000_000, 61_000_000, 55_000_000, 67_000_000, 58_400_000 },
                ChartExpenses = new List<decimal> { 20_000_000, 22_000_000, 19_000_000, 25_000_000, 23_000_000, 28_000_000, 21_150_000 },

                ExpenseCategoryLabels = new List<string> { "Salaries", "Utilities", "Marketing", "Office", "Other" },
                ExpenseCategoryValues = new List<decimal> { 9_200_000, 3_150_000, 4_800_000, 2_100_000, 1_900_000 },

                RecentJournals = new List<JournalEntryDto>
                {
                    new() { ReferenceNo = "JV-2026/07/004", Date = new DateTime(2026, 7, 24), Memo = "Accounts receivable collection", TotalDebit = 12_500_000, TotalCredit = 12_500_000 },
                    new() { ReferenceNo = "JV-2026/07/003", Date = new DateTime(2026, 7, 22), Memo = "Utility payment – electricity", TotalDebit = 3_200_000, TotalCredit = 3_200_000 },
                    new() { ReferenceNo = "JV-2026/07/002", Date = new DateTime(2026, 7, 18), Memo = "Office supplies purchase", TotalDebit = 1_850_000, TotalCredit = 1_850_000 },
                    new() { ReferenceNo = "JV-2026/07/001", Date = new DateTime(2026, 7, 15), Memo = "Sales revenue – July batch", TotalDebit = 28_750_000, TotalCredit = 28_750_000 }
                },

                MainCoaBalances = new List<CoaBalanceDto>
                {
                    new() { AccountCode = "1010", AccountName = "Cash – Main Account", Category = "Assets", Balance = 42_500_000 },
                    new() { AccountCode = "1030", AccountName = "Accounts Receivable", Category = "Assets", Balance = 18_200_000 },
                    new() { AccountCode = "2010", AccountName = "Accounts Payable", Category = "Liabilities", Balance = 12_800_000 },
                    new() { AccountCode = "3010", AccountName = "Owner's Equity", Category = "Equity", Balance = 185_000_000 }
                },

                ActivePeriodName = "July 2026"
            };

            return View(model);
        }
    }
}
