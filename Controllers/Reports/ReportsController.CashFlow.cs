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

            // 3. Olah setiap baris dari Trial Balance
            foreach (var r in rows)
            {
                // Abaikan jika saldo 0 atau merupakan akun Kas/Setara Kas maupun Retained Earnings
                if (r.NetBalance == 0 || r.Role == "CashAndEquivalents" || r.Role == "RetainedEarnings")
                    continue;

                // Abaikan akun nominal Laba Rugi (Ref >= 400 atau IsTemporary)
                // karena nilainya SUDAH diwakili oleh Net Income di atas
                if (AccountClassification.IsTemporary(r.Type) || r.ReferenceNumber >= 400)
                    continue;

                // --------------------------------------------------
                // A. ASSETS (Ref 100 - 199)
                // --------------------------------------------------
                if (r.Type == "Assets" || (r.ReferenceNumber >= 100 && r.ReferenceNumber <= 199))
                {
                    // Cek jika akun termasuk Aset Tetap / Akumulasi Depresiasi (Ref >= 150 atau ada kata "Depreciation"/"Equipment"/"Vehicle"/"Building")
                    bool isFixedAsset = r.ReferenceNumber >= 150 ||
                                       r.AccountName.Contains("Equipment", StringComparison.OrdinalIgnoreCase) ||
                                       r.AccountName.Contains("Depreciation", StringComparison.OrdinalIgnoreCase) ||
                                       r.AccountName.Contains("Asset", StringComparison.OrdinalIgnoreCase);

                    if (isFixedAsset)
                    {
                        vm.InvestingActivities.Add(new CashFlowLine
                        {
                            Description = $"Capital expenditure / Sale of {r.AccountName}",
                            Amount = -r.NetBalance
                        });
                    }
                    else
                    {
                        // Aset Lancar Operasional Non-Kas (Piutang, Perlengkapan, Sewa Dibayar Dimuka, dll)
                        vm.OperatingActivities.Add(new CashFlowLine
                        {
                            Description = $"Change in {r.AccountName}",
                            Amount = -r.NetBalance
                        });
                    }
                }
                // --------------------------------------------------
                // B. LIABILITIES (Ref 200 - 299)
                // --------------------------------------------------
                else if (r.Type == "Liabilities" || (r.ReferenceNumber >= 200 && r.ReferenceNumber <= 299))
                {
                    bool isLongTermDebt = r.ReferenceNumber >= 250 ||
                                          r.AccountName.Contains("Bank Loan", StringComparison.OrdinalIgnoreCase) ||
                                          r.AccountName.Contains("Long Term", StringComparison.OrdinalIgnoreCase);

                    if (isLongTermDebt)
                    {
                        vm.FinancingActivities.Add(new CashFlowLine
                        {
                            Description = $"Change in {r.AccountName}",
                            Amount = r.NetBalance
                        });
                    }
                    else
                    {
                        // Utang Lancar Operasional (Utang Usaha, Beban Akrual, Utang Pajak, dll)
                        vm.OperatingActivities.Add(new CashFlowLine
                        {
                            Description = $"Change in {r.AccountName}",
                            Amount = r.NetBalance
                        });
                    }
                }
                // --------------------------------------------------
                // C. EQUITY (Ref 300 - 399)
                // --------------------------------------------------
                else if (r.Type == "Equity" || (r.ReferenceNumber >= 300 && r.ReferenceNumber <= 399))
                {
                    vm.FinancingActivities.Add(new CashFlowLine
                    {
                        Description = $"Change in {r.AccountName}",
                        Amount = r.NetBalance
                    });
                }
                // --------------------------------------------------
                // D. FALLBACK UNTUK AKUN DENGAN TYPE/REF TIDAK TERDETEKSI
                // --------------------------------------------------
                else
                {
                    vm.OperatingActivities.Add(new CashFlowLine
                    {
                        Description = $"Adjustment for {r.AccountName}",
                        Amount = -r.NetBalance
                    });
                }
            }

            // 4. Hitung Kas Awal secara otomatis: Ending Cash - Total Change
            vm.BeginningCash = endingCash - vm.NetChangeInCash;

            return View(vm);
        }
    }
}
