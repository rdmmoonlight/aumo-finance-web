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

            // 1. Ambil baris Adjusted Trial Balance periode berjalan
            var rows = await BuildTrialBalanceRowsAsync(userId, period, includeAdjusting: true);
            var incomeStatement = BuildIncomeStatement(rows, period);

            // 2. Hitung Kas Akhir dari akun ber-role CashAndEquivalents
            var cashRows = rows.Where(r => r.Role == "CashAndEquivalents").ToList();
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

            // 3. Olah setiap baris akun permanen (Neraca) dari Trial Balance
            foreach (var r in rows)
            {
                // Abaikan jika saldo 0, atau merupakan akun Kas/Setara Kas maupun Retained Earnings
                if (r.NetBalance == 0 || r.Role == "CashAndEquivalents" || r.Role == "RetainedEarnings")
                    continue;

                // Abaikan akun nominal (Laba Rugi: Ref >= 400) karena nilainya SUDAH diwakili oleh Net Income
                if (AccountClassification.IsTemporary(r.Type) || r.ReferenceNumber >= 400)
                    continue;

                // --------------------------------------------------
                // A. ASSETS (Ref 100 - 199)
                // --------------------------------------------------
                if (r.Type == "Assets")
                {
                    if (r.ReferenceNumber < 150)
                    {
                        // Aset Lancar Operasional Non-Kas (Piutang, Perlengkapan, Sewa Dibayar Dimuka)
                        // Kenaikan aset mengikat kas (-), Penurunan aset membebaskan kas (+)
                        vm.OperatingActivities.Add(new CashFlowLine
                        {
                            Description = $"Change in {r.AccountName}",
                            Amount = -r.NetBalance
                        });
                    }
                    else
                    {
                        // Aset Tetap & Investasi (Peralatan, Mesin, Kendaraan, Akumulasi Depresiasi)
                        vm.InvestingActivities.Add(new CashFlowLine
                        {
                            Description = $"Capital expenditure / Sale of {r.AccountName}",
                            Amount = -r.NetBalance
                        });
                    }
                }
                // --------------------------------------------------
                // B. LIABILITIES (Ref 200 - 299)
                // --------------------------------------------------
                else if (r.Type == "Liabilities")
                {
                    if (r.ReferenceNumber < 250)
                    {
                        // Utang Lancar Operasional (Utang Usaha, Beban YAD Dibayar, Utang Pajak)
                        // Kenaikan utang membebaskan kas (+), Penurunan utang memakai kas (-)
                        vm.OperatingActivities.Add(new CashFlowLine
                        {
                            Description = $"Change in {r.AccountName}",
                            Amount = r.NetBalance
                        });
                    }
                    else
                    {
                        // Utang Jangka Panjang (Utang Bank Jangka Panjang, Obligasi)
                        vm.FinancingActivities.Add(new CashFlowLine
                        {
                            Description = $"Change in {r.AccountName}",
                            Amount = r.NetBalance
                        });
                    }
                }
                // --------------------------------------------------
                // C. EQUITY (Ref 300 - 399)
                // --------------------------------------------------
                else if (r.Type == "Equity")
                {
                    // Modal Pemilik, Prive/Withdrawal
                    vm.FinancingActivities.Add(new CashFlowLine
                    {
                        Description = $"Change in {r.AccountName}",
                        Amount = r.NetBalance
                    });
                }
            }

            // 4. Hitung Kas Awal secara otomatis: Kas Awal = Kas Akhir - Perubahan Bersih Kas
            vm.BeginningCash = endingCash - vm.NetChangeInCash;

            return View(vm);
        }
    }
}
