using Microsoft.AspNetCore.Mvc;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public partial class ReportsController
    {
        // ==========================================================
        // CASH FLOW STATEMENT (Indirect Method - IAS 7)
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

            // 1. Ambil data Trial Balance periode berjalan
            var rows = await BuildTrialBalanceRowsAsync(userId, period, includeAdjusting: true);
            var incomeStatement = BuildIncomeStatement(rows, period);

            // 2. Ambil Kas Akhir dari akun ber-role CashAndEquivalents
            var cashRows = rows.Where(r => r.Role == "CashAndEquivalents" || r.Role == "Cash").ToList();
            decimal endingCash = cashRows.Sum(r => r.NetBalance);

            var vm = new CashFlowStatementViewModel
            {
                // Baris pertama Operating diawali dari Laba Bersih (Net Income)
                OperatingActivities = new List<CashFlowLine>
                {
                    new CashFlowLine
                    {
                        Description = "Net Income per Income Statement",
                        Amount = incomeStatement.NetIncome
                    }
                }
            };

            // 3. Olah setiap baris Trial Balance
            foreach (var r in rows)
            {
                // Abaikan akun jika saldonya 0 atau merupakan akun Kas itu sendiri
                if (r.NetBalance == 0 || r.Role == "CashAndEquivalents" || r.Role == "Cash") 
                    continue;

                // Abaikan akun nominal (Pendapatan & Beban) karena nilainya SUDAH diwakili oleh Net Income
                if (r.Type == "OperatingIncome" || r.Type == "OperatingExpenses" || 
                    r.Type == "OtherIncome" || r.Type == "OtherExpenses" || 
                    r.Type == "Revenue" || r.Type == "Expense")
                {
                    continue;
                }

                var role = r.Role ?? "";
                var type = r.Type ?? "";

                // A. OPERATING ACTIVITIES (Penyesuaian Modal Kerja / Working Capital)
                // Aset Lancar Non-Kas: Piutang, Perlengkapan, Sewa Dibayar Dimuka, PPN Masukan, dll.
                if (role == "AccountsReceivable" || role == "CurrentAsset" || role == "Inventory" || 
                    type == "CurrentAsset" || (type == "Assets" && role != "FixedAsset" && role != "NonCurrentAsset" && role != "Investment"))
                {
                    vm.OperatingActivities.Add(new CashFlowLine
                    {
                        Description = $"Change in {r.AccountName}",
                        Amount = -r.NetBalance // Kenaikan aset mengikat kas (-)
                    });
                }
                // Utang Lancar: Utang Usaha, Utang Gaji, Utang Pajak, PPN Keluaran, dll.
                else if (role == "AccountsPayable" || role == "CurrentLiability" || 
                         type == "CurrentLiability" || (type == "Liabilities" && role != "LongTermDebt" && role != "NonCurrentLiability"))
                {
                    vm.OperatingActivities.Add(new CashFlowLine
                    {
                        Description = $"Change in {r.AccountName}",
                        Amount = r.NetBalance // Kenaikan utang membebaskan kas (+)
                    });
                }
                // B. INVESTING ACTIVITIES
                // Aset Tetap, Akumulasi Penyusutan, Aset Tak Wujud, Investasi Jangka Panjang
                else if (role == "FixedAsset" || role == "NonCurrentAsset" || role == "Investment" || 
                         type == "FixedAsset" || type == "NonCurrentAsset")
                {
                    vm.InvestingActivities.Add(new CashFlowLine
                    {
                        Description = $"Capital expenditure / Sale of {r.AccountName}",
                        Amount = -r.NetBalance
                    });
                }
                // C. FINANCING ACTIVITIES
                // Modal Pemilik, Prive/Withdrawal, Utang Bank Jangka Panjang, Kewajiban Tidak Lancar
                else if (type == "Equity" || role == "Equity" || 
                         role == "LongTermDebt" || role == "NonCurrentLiability" || type == "NonCurrentLiability")
                {
                    // Abaikan Retained Earnings karena sudah dihitung via Net Income
                    if (role == "RetainedEarnings") continue;

                    vm.FinancingActivities.Add(new CashFlowLine
                    {
                        Description = $"Change in {r.AccountName}",
                        Amount = r.NetBalance
                    });
                }
            }

            // 4. Hitung Kas Awal secara otomatis: Ending Cash - Total Mutasi Kas
            vm.BeginningCash = endingCash - vm.NetChangeInCash;

            return View(vm);
        }
    }
}
