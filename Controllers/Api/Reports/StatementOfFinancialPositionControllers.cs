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
                asOfDate = (DateTime?)null,
                balanceSheet = (object?)null
            });
        }

        var balanceSheetData = await BuildSofpAsync(_db, userId, period, isPostClosing);

        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = period.PeriodName,
            asOfDate = period.EndDate,
            balanceSheet = balanceSheetData
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
