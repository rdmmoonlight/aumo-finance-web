using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoFinance.Models;
using AumoFinance.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers.Web.Reports;

[ApiController]
[Route("web/reports/statement-of-financial-position")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class StatementOfFinancialPositionWebController : ControllerBase
{
    private readonly AppDbContext _db;

    public StatementOfFinancialPositionWebController(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /web/reports/statement-of-financial-position?isPostClosing=false
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetStatementOfFinancialPosition([FromQuery] bool isPostClosing = false)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

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

        var equityAccountsWithRe = balanceSheetData.EquityExcludingRetainedEarnings
            .Select(e => new { accountId = 0, referenceNumber = e.ReferenceNumber, accountName = e.AccountName, amount = e.Amount })
            .Append(new { accountId = 0, referenceNumber = 0, accountName = "Retained Earnings", amount = balanceSheetData.RetainedEarningsEnding })
            .ToList();

        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = period.PeriodName,
            asOfDate = balanceSheetData.AsOfDate,
            isPostClosing = balanceSheetData.IsPostClosing,
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

    public static async Task<StatementOfFinancialPositionWebApiResponse> BuildSofpAsync(AppDbContext db, Guid userId, Period period, bool isPostClosing)
    {
        var rows = await TrialBalanceController.BuildTrialBalanceRowsAsync(db, userId, period, includeAdjusting: true);
        var re = await RetainedEarningsWebController.BuildRetainedEarningsAsync(db, userId, period);

        FinancialPositionLineWebApiResponse ToLine(TrialBalanceRow r) => new()
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

        return new StatementOfFinancialPositionWebApiResponse
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
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");

        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class StatementOfFinancialPositionWebApiResponse
{
    public DateTime AsOfDate { get; set; }
    public bool IsPostClosing { get; set; }
    public List<FinancialPositionLineWebApiResponse> Assets { get; set; } = new();
    public decimal TotalAssets { get; set; }
    public List<FinancialPositionLineWebApiResponse> Liabilities { get; set; } = new();
    public decimal TotalLiabilities { get; set; }
    public List<FinancialPositionLineWebApiResponse> EquityExcludingRetainedEarnings { get; set; } = new();
    public decimal RetainedEarningsEnding { get; set; }
    public decimal TotalEquity { get; set; }
    public decimal TotalLiabilitiesAndEquity { get; set; }
    public bool IsBalanced { get; set; }
}

public class FinancialPositionLineWebApiResponse
{
    public int ReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}