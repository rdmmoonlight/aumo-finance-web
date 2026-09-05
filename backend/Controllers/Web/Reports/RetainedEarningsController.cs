using System;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoFinance.Models;
using AumoFinance.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers.Web.Reports;

[ApiController]
[Route("web/reports/retained-earnings")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class RetainedEarningsWebController : ControllerBase
{
    private readonly AppDbContext _db;

    public RetainedEarningsWebController(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /web/reports/retained-earnings
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetRetainedEarnings()
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
                accountName = "Retained Earnings",
                startDate = (DateTime?)null,
                endDate = (DateTime?)null,
                beginningRetainedEarnings = 0m,
                netIncome = 0m,
                dividendsOrDraws = 0m,
                endingRetainedEarnings = 0m
            });
        }

        var statementData = await BuildRetainedEarningsAsync(_db, userId, period);

        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = period.PeriodName,
            accountName = statementData.AccountName,
            startDate = statementData.StartDate,
            endDate = statementData.EndDate,
            beginningRetainedEarnings = statementData.BeginningBalance,
            netIncome = statementData.NetIncome,
            dividendsOrDraws = statementData.Dividends,
            endingRetainedEarnings = statementData.EndingBalance
        });
    }

    public static async Task<RetainedEarningsWebApiResponse> BuildRetainedEarningsAsync(AppDbContext db, Guid userId, Period period)
    {
        var rows = await TrialBalanceController.BuildTrialBalanceRowsAsync(db, userId, period, includeAdjusting: true);
        var incomeStatement = IncomeStatementWebController.BuildIncomeStatement(rows, period);
        var reAccount = rows.Find(r => r.Role == "RetainedEarnings");

        decimal beginningBalance = reAccount?.NetBalance ?? 0m;
        decimal netIncome = incomeStatement.NetIncome;
        decimal dividends = 0m;
        decimal endingBalance = beginningBalance + netIncome - dividends;

        return new RetainedEarningsWebApiResponse
        {
            AccountName = reAccount?.AccountName ?? "Retained Earnings",
            StartDate = period.StartDate,
            EndDate = period.EndDate,
            BeginningBalance = beginningBalance,
            NetIncome = netIncome,
            Dividends = dividends,
            EndingBalance = endingBalance
        };
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");

        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class RetainedEarningsWebApiResponse
{
    public string AccountName { get; set; } = "Retained Earnings";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal BeginningBalance { get; set; }
    public decimal NetIncome { get; set; }
    public decimal Dividends { get; set; }
    public decimal EndingBalance { get; set; }
}