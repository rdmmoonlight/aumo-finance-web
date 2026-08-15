using System;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoFinance.Models;
using AumoFinance.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers.Api.Reports;

[ApiController]
[Route("api/mobile/reports/retained-earnings")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class RetainedEarningsControllers : ControllerBase
{
    private readonly AppDbContext _db;

    public RetainedEarningsControllers(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /api/mobile/reports/retained-earnings
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetRetainedEarnings()
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
                beginningRetainedEarnings = 0m,
                netIncome = 0m,
                dividendsOrDraws = 0m,
                endingRetainedEarnings = 0m
            });
        }

        var statementData = await BuildRetainedEarningsAsync(_db, userId, period);

        // Response is flattened to match the Android RetainedEarningsReportApiResponse DTO
        // exactly (top-level fields), instead of nesting under a "retainedEarnings" object
        // with different field names — same pattern fix as Worksheet/Income Statement.
        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = period.PeriodName,
            beginningRetainedEarnings = statementData.BeginningBalance,
            netIncome = statementData.NetIncome,
            dividendsOrDraws = statementData.Dividends,
            endingRetainedEarnings = statementData.EndingBalance
        });
    }

    public static async Task<RetainedEarningsApiResponse> BuildRetainedEarningsAsync(AppDbContext db, Guid userId, Period period)
    {
        var rows = await TrialBalanceControllers.BuildTrialBalanceRowsAsync(db, userId, period, includeAdjusting: true);
        var incomeStatement = IncomeStatementControllers.BuildIncomeStatement(rows, period);
        var reAccount = rows.Find(r => r.Role == "RetainedEarnings");

        decimal beginningBalance = reAccount?.NetBalance ?? 0m;
        decimal netIncome = incomeStatement.NetIncome;
        decimal dividends = 0m;
        decimal endingBalance = beginningBalance + netIncome - dividends;

        return new RetainedEarningsApiResponse
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
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class RetainedEarningsApiResponse
{
    public string AccountName { get; set; } = "Retained Earnings";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal BeginningBalance { get; set; }
    public decimal NetIncome { get; set; }
    public decimal Dividends { get; set; }
    public decimal EndingBalance { get; set; }
}
