using Microsoft.AspNetCore.Mvc;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public partial class ReportsController
    {
        // CASH FLOW STATEMENT (Indirect Method - IAS 7)

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

            var rows = await BuildTrialBalanceRowsAsync(userId, period, includeAdjusting: true);
            var incomeStatement = BuildIncomeStatement(rows, period);

            var cashRows = rows.Where(r => r.Role == "CashAndEquivalents").ToList();
            decimal endingCash = cashRows.Sum(r => r.NetBalance);

            var vm = new CashFlowStatementViewModel
            {
                OperatingActivities = new List<CashFlowLine>
                {
                    new CashFlowLine
                    {
                        Description = "Net Income per Income Statement",
                        Amount = incomeStatement.NetIncome
                    }
                }
            };

            foreach (var r in rows)
            {
                // BARIS INI PENYEBAB UTAMA — cek dulu ini
                if (r.NetBalance == 0 || r.Role == "CashAndEquivalents" || r.Role == "RetainedEarnings")
                    continue;

                if (AccountClassification.IsTemporary(r.Type) || r.ReferenceNumber >= 400)
                    continue;

                if (r.Type == "Assets" || (r.ReferenceNumber >= 100 && r.ReferenceNumber <= 199))
                {
                    bool isFixedAsset = r.ReferenceNumber >= 150 ||
                                       r.AccountName.Contains("Equipment", StringComparison.OrdinalIgnoreCase) ||
                                       r.AccountName.Contains("Depreciation", StringComparison.OrdinalIgnoreCase) ||
                                       r.AccountName.Contains("Asset", StringComparison.OrdinalIgnoreCase);

                    if (isFixedAsset)
                        vm.InvestingActivities.Add(new CashFlowLine { Description = $"Capital expenditure / Sale of {r.AccountName}", Amount = -r.NetBalance });
                    else
                        vm.OperatingActivities.Add(new CashFlowLine { Description = $"Change in {r.AccountName}", Amount = -r.NetBalance });
                }
                else if (r.Type == "Liabilities" || (r.ReferenceNumber >= 200 && r.ReferenceNumber <= 299))
                {
                    bool isLongTermDebt = r.ReferenceNumber >= 250 ||
                                          r.AccountName.Contains("Bank Loan", StringComparison.OrdinalIgnoreCase) ||
                                          r.AccountName.Contains("Long Term", StringComparison.OrdinalIgnoreCase);

                    if (isLongTermDebt)
                        vm.FinancingActivities.Add(new CashFlowLine { Description = $"Change in {r.AccountName}", Amount = r.NetBalance });
                    else
                        vm.OperatingActivities.Add(new CashFlowLine { Description = $"Change in {r.AccountName}", Amount = r.NetBalance });
                }
                else if (r.Type == "Equity" || (r.ReferenceNumber >= 300 && r.ReferenceNumber <= 399))
                {
                    vm.FinancingActivities.Add(new CashFlowLine { Description = $"Change in {r.AccountName}", Amount = r.NetBalance });
                }
                else
                {
                    vm.OperatingActivities.Add(new CashFlowLine { Description = $"Adjustment for {r.AccountName}", Amount = -r.NetBalance });
                }
            }

            vm.BeginningCash = endingCash - vm.NetChangeInCash;
            return View(vm);
        }
    }
}
