using Microsoft.AspNetCore.Mvc;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public partial class ReportsController
    {
        // ==========================================================
        // CASH FLOW STATEMENT (Indirect Method - From Trial Balance)
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

            // 1. Ambil data Trial Balance periode berjalan (termasuk Laba Rugi)
            var rows = await BuildTrialBalanceRowsAsync(userId, period, includeAdjusting: true);
            var incomeStatement = BuildIncomeStatement(rows, period);

            // 2. Ambil Kas Awal & Kas Akhir dari baris Trial Balance yang ber-role CashAndEquivalents
            var cashRows = rows.Where(r => r.Role == "CashAndEquivalents").ToList();
            
            // Di Trial Balance, saldo kas akhir adalah NetBalance dari akun Kas
            decimal endingCash = cashRows.Sum(r => r.NetBalance);

            var vm = new CashFlowStatementViewModel
            {
                // Net Operating diawali dari Net Income Laporan Laba Rugi
                OperatingActivities = new List<CashFlowLine>
                {
                    new CashFlowLine
                    {
                        Description = "Net Income",
                        Amount = incomeStatement.NetIncome
                    }
                }
            };

            // 3. Olah setiap baris Trial Balance untuk penyesuaian Arus Kas
            foreach (var r in rows)
            {
                if (r.NetBalance == 0) continue;

                var role = r.Role ?? "";
                var type = r.Type ?? "";

                // ASET LANCAR NON-KAS (Piutang, Perlengkapan, Sewa Dibayar Dimuka, dll)
                // Kenaikan Aset (-) mengikat kas, Penurunan Aset (+) membebaskan kas
                if (role == "AccountsReceivable" || role == "CurrentAsset")
                {
                    vm.OperatingActivities.Add(new CashFlowLine
                    {
                        Description = $"Adjustment for {r.AccountName}",
                        Amount = -r.NetBalance
                    });
                }
                // UTANG LANCAR (Utang Usaha, Beban Akrual, dll)
                // Kenaikan Utang (+) menambah kas/pembayaran tertunda, Penurunan Utang (-) memakai kas
                else if (role == "AccountsPayable" || role == "CurrentLiability")
                {
                    vm.OperatingActivities.Add(new CashFlowLine
                    {
                        Description = $"Adjustment for {r.AccountName}",
                        Amount = r.NetBalance
                    });
                }
                // AKTIVITAS INVESTASI (Aset Tetap, Aset Tak Wujud, Investasi)
                else if (type == "Assets" && role != "CashAndEquivalents" && role != "CurrentAsset" && role != "AccountsReceivable")
                {
                    vm.InvestingActivities.Add(new CashFlowLine
                    {
                        Description = $"Capital expenditure / Sale of {r.AccountName}",
                        Amount = -r.NetBalance
                    });
                }
                // AKTIVITAS PENDANAAN (Modal Pemilik, Prive, Utang Jangka Panjang)
                else if ((type == "Equity" && role != "RetainedEarnings") || role == "LongTermDebt" || role == "NonCurrentLiability")
                {
                    vm.FinancingActivities.Add(new CashFlowLine
                    {
                        Description = $"Equity / Financing from {r.AccountName}",
                        Amount = r.NetBalance
                    });
                }
            }

            // 4. Hitung Saldo Awal Kas secara matematik: Ending Cash - Total Perubahan Kas Periode Ini
            // Rumus: Beginning Cash = Ending Cash - NetChangeInCash
            vm.BeginningCash = endingCash - vm.NetChangeInCash;

            return View(vm);
        }
    }
}
