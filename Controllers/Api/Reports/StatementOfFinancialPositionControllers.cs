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
[Route("api/mobile/reports/statement-of-financial-position")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class StatementOfFinancialPositionControllers : ControllerBase
{
    private readonly AppDbContext _db;

    public StatementOfFinancialPositionControllers(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /api/mobile/reports/statement-of-financial-position?isPostClosing=false
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetStatementOfFinancialPosition([FromQuery] bool isPostClosing = false)
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
                assetAccounts = new List<object>(),
                totalAssets = 0m,
                liabilityAccounts = new List<object>(),
                totalLiabilities = 0m,
                equityAccounts = new List<object>(),
                totalEquity = 0m,
                totalLiabilitiesAndEquity = 0m,
                isBalanced = true
            });
        }

        var balanceSheetData = await BuildSofpAsync(_db, userId, period, isPostClosing);

        // Response is flattened to match the Android StatementOfFinancialPositionReportApiResponse
        // DTO exactly (top-level fields), instead of nesting under a "balanceSheet" object with
        // different field names — same pattern fix as Worksheet/Income Statement/Retained Earnings.
        // Retained Earnings (ending) is appended to equityAccounts since Android has no separate field for it.
        var equityAccountsWithRe = balanceSheetData.EquityExcludingRetainedEarnings
            .Select(e => new { accountId = 0, referenceNumber = e.ReferenceNumber, accountName = e.AccountName, amount = e.Amount })
            .Append(new { accountId = 0, referenceNumber = 0, accountName = "Retained Earnings", amount = balanceSheetData.RetainedEarningsEnding })
            .ToList();

        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = period.PeriodName,
            assetAccounts = balanceSheetData.Assets.Select(a => new { accountId = 0, referenceNumber = a.ReferenceNumber, accountName = a.AccountName, amount = a.Amount }),
            totalAssets = balanceSheetData.TotalAssets,
            liabilityAccounts = balanceSheetData.Liabilities.Select(l => new { accountId = 0, referenceNumber = l.ReferenceNumber, accountName = l.AccountName, amount = l.Amount }),
            totalLiabilities = balanceSheetData.TotalLiabilities,
            equityAccounts = equityAccountsWithRe,
            totalEquity = balanceSheetData.TotalEquity,
            totalLiabilitiesAndEquity = balanceSheetData.TotalLiabilitiesAndEquity,
            isBalanced = balanceSheetData.IsBalanced
        });
    }

    public static async Task<StatementOfFinancialPositionApiResponse> BuildSofpAsync(AppDbContext db, Guid userId, Period period, bool isPostClosing)
    {
        var rows = await TrialBalanceControllers.BuildTrialBalanceRowsAsync(db, userId, period, includeAdjusting: true);
        var re = await RetainedEarningsControllers.BuildRetainedEarningsAsync(db, userId, period);

        FinancialPositionLineApiResponse ToLine(TrialBalanceRow r) => new()
        {
            ReferenceNumber = r.ReferenceNumber,
            AccountName = r.AccountName,
            Amount = r.NetBalance
        };

        var assets = rows.Where(r => r.Type == "Assets").Select(ToLine).ToList();
        var liabilities = rows.Where(r => r.Type == "Liabilities").Select(ToLine).ToList();
        var equityExcludingRe = rows.Where(r => r.Type == "Equity" && r.Role != "RetainedEarnings").Select(ToLine).ToList();

        decimal totalAssets = assets.Sum(a => a.Amount);
        decimal totalLiabilities = liabilities.Sum(l => l.Amount);
        decimal totalEquityExcludingRe = equityExcludingRe.Sum(e => e.Amount);
        decimal retainedEarningsEnding = re.EndingBalance;

        decimal totalEquity = totalEquityExcludingRe + retainedEarningsEnding;
        decimal totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

        bool isBalanced = Math.Round(totalAssets - totalLiabilitiesAndEquity, 2) == 0;

        return new StatementOfFinancialPositionApiResponse
        {
            AsOfDate = period.EndDate,
            IsPostClosing = isPostClosing,
            Assets = assets,
            TotalAssets = totalAssets,
            Liabilities = liabilities,
            TotalLiabilities = totalLiabilities,
            EquityExcludingRetainedEarnings = equityExcludingRe,
            RetainedEarningsEnding = retainedEarningsEnding,
            TotalEquity = totalEquity,
            TotalLiabilitiesAndEquity = totalLiabilitiesAndEquity,
            IsBalanced = isBalanced
        };
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class StatementOfFinancialPositionApiResponse
{
    public DateTime AsOfDate { get; set; }
    public bool IsPostClosing { get; set; }
    public List<FinancialPositionLineApiResponse> Assets { get; set; } = new();
    public decimal TotalAssets { get; set; }
    public List<FinancialPositionLineApiResponse> Liabilities { get; set; } = new();
    public decimal TotalLiabilities { get; set; }
    public List<FinancialPositionLineApiResponse> EquityExcludingRetainedEarnings { get; set; } = new();
    public decimal RetainedEarningsEnding { get; set; }
    public decimal TotalEquity { get; set; }
    public decimal TotalLiabilitiesAndEquity { get; set; }
    public bool IsBalanced { get; set; }
}

public class FinancialPositionLineApiResponse
{
    public int ReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}
