using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoFinance.Models;
using AumoFinance.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers.Api.Reports;

[ApiController]
[Route("api/mobile/reports/cash-flow")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class CashFlowControllers : ControllerBase
{
    private readonly AppDbContext _db;

    public CashFlowControllers(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /api/mobile/reports/cash-flow
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetCashFlowStatement()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var period = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
        if (period == null)
        {
            return Ok(new
            {
                success = true,
                hasPeriodSelected = false,
                message = "No accounting period selected.",
                selectedPeriodName = (string?)null,
                operatingActivities = new List<CashFlowLineApiResponse>(),
                netCashFromOperating = 0m,
                investingActivities = new List<CashFlowLineApiResponse>(),
                netCashFromInvesting = 0m,
                financingActivities = new List<CashFlowLineApiResponse>(),
                netCashFromFinancing = 0m,
                netChangeInCash = 0m,
                beginningCash = 0m,
                endingCash = 0m
            });
        }

        var rows = await TrialBalanceControllers.BuildTrialBalanceRowsAsync(_db, userId, period, includeAdjusting: true);
        var incomeStatement = IncomeStatementControllers.BuildIncomeStatement(rows, period);

        var cashRows = rows.Where(r => r.Role == "CashAndEquivalents").ToList();
        decimal endingCash = cashRows.Sum(r => r.NetBalance);

        var operatingActivities = new List<CashFlowLineApiResponse>
        {
            new CashFlowLineApiResponse
            {
                Description = "Net Income per Income Statement",
                Amount = incomeStatement.NetIncome
            }
        };

        var investingActivities = new List<CashFlowLineApiResponse>();
        var financingActivities = new List<CashFlowLineApiResponse>();

        foreach (var r in rows)
        {
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
                    investingActivities.Add(new CashFlowLineApiResponse { Description = $"Capital expenditure / Sale of {r.AccountName}", Amount = -r.NetBalance });
                else
                    operatingActivities.Add(new CashFlowLineApiResponse { Description = $"Change in {r.AccountName}", Amount = -r.NetBalance });
            }
            else if (r.Type == "Liabilities" || (r.ReferenceNumber >= 200 && r.ReferenceNumber <= 299))
            {
                bool isLongTermDebt = r.ReferenceNumber >= 250 ||
                                      r.AccountName.Contains("Bank Loan", StringComparison.OrdinalIgnoreCase) ||
                                      r.AccountName.Contains("Long Term", StringComparison.OrdinalIgnoreCase);

                if (isLongTermDebt)
                    financingActivities.Add(new CashFlowLineApiResponse { Description = $"Change in {r.AccountName}", Amount = r.NetBalance });
                else
                    operatingActivities.Add(new CashFlowLineApiResponse { Description = $"Change in {r.AccountName}", Amount = r.NetBalance });
            }
            else if (r.Type == "Equity" || (r.ReferenceNumber >= 300 && r.ReferenceNumber <= 399))
            {
                financingActivities.Add(new CashFlowLineApiResponse { Description = $"Change in {r.AccountName}", Amount = r.NetBalance });
            }
            else
            {
                operatingActivities.Add(new CashFlowLineApiResponse { Description = $"Adjustment for {r.AccountName}", Amount = -r.NetBalance });
            }
        }

        decimal netOperating = operatingActivities.Sum(a => a.Amount);
        decimal netInvesting = investingActivities.Sum(a => a.Amount);
        decimal netFinancing = financingActivities.Sum(a => a.Amount);

        decimal netChangeInCash = netOperating + netInvesting + netFinancing;
        decimal beginningCash = endingCash - netChangeInCash;

        // Response is flattened to match the Android StatementOfCashFlowsReportApiResponse
        // DTO exactly (top-level fields, netCashFromX names), instead of nesting under a
        // "cashFlowStatement" object with different field names — same pattern fix as
        // Worksheet/Income Statement/Retained Earnings/Statement of Financial Position.
        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = period.PeriodName,
            operatingActivities = operatingActivities,
            netCashFromOperating = netOperating,
            investingActivities = investingActivities,
            netCashFromInvesting = netInvesting,
            financingActivities = financingActivities,
            netCashFromFinancing = netFinancing,
            netChangeInCash = netChangeInCash,
            beginningCash = beginningCash,
            endingCash = endingCash
        });
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class CashFlowLineApiResponse
{
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}
