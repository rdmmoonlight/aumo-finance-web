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
[Route("web/reports/income-statement")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class IncomeStatementWebController : ControllerBase
{
    private readonly AppDbContext _db;

    public IncomeStatementWebController(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /web/reports/income-statement
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetIncomeStatement()
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
                revenueAccounts = Array.Empty<object>(),
                expenseAccounts = Array.Empty<object>(),
                otherIncomeAccounts = Array.Empty<object>(),
                otherExpenseAccounts = Array.Empty<object>()
            });
        }

        var rows = await TrialBalanceController.BuildTrialBalanceRowsAsync(_db, userId, period, includeAdjusting: true);
        var statementData = BuildIncomeStatement(rows, period);

        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = period.PeriodName,
            asOfDate = statementData.AsOfDate,
            revenueAccounts = statementData.Revenues,
            totalRevenue = statementData.TotalRevenue,
            expenseAccounts = statementData.OperatingExpenses,
            totalExpenses = statementData.TotalOperatingExpenses,
            operatingIncome = statementData.OperatingIncome,
            otherIncomeAccounts = statementData.OtherIncome,
            otherExpenseAccounts = statementData.OtherExpenses,
            totalOtherIncome = statementData.TotalOtherIncome,
            totalOtherExpenses = statementData.TotalOtherExpenses,
            netIncome = statementData.NetIncome
        });
    }

    public static IncomeStatementWebApiResponse BuildIncomeStatement(List<TrialBalanceRow> rows, Period period)
    {
        IncomeStatementLineWebApiResponse ToLine(TrialBalanceRow r) => new()
        {
            ReferenceNumber = r.ReferenceNumber,
            AccountName = r.AccountName,
            Amount = r.NetBalance
        };

        var revenues = rows.Where(r => r.Type == "OperatingIncome").Select(ToLine).ToList();
        var operatingExpenses = rows.Where(r => r.Type == "OperatingExpenses").Select(ToLine).ToList();
        var otherIncome = rows.Where(r => r.Type == "OtherIncome").Select(ToLine).ToList();
        var otherExpenses = rows.Where(r => r.Type == "OtherExpenses").Select(ToLine).ToList();

        decimal totalRevenue = revenues.Sum(r => r.Amount);
        decimal totalOperatingExpenses = operatingExpenses.Sum(e => e.Amount);
        decimal operatingIncome = totalRevenue - totalOperatingExpenses;

        decimal totalOtherIncome = otherIncome.Sum(i => i.Amount);
        decimal totalOtherExpenses = otherExpenses.Sum(e => e.Amount);

        decimal netIncome = operatingIncome + totalOtherIncome - totalOtherExpenses;

        return new IncomeStatementWebApiResponse
        {
            AsOfDate = period.EndDate,
            Revenues = revenues,
            TotalRevenue = totalRevenue,
            OperatingExpenses = operatingExpenses,
            TotalOperatingExpenses = totalOperatingExpenses,
            OperatingIncome = operatingIncome,
            OtherIncome = otherIncome,
            TotalOtherIncome = totalOtherIncome,
            OtherExpenses = otherExpenses,
            TotalOtherExpenses = totalOtherExpenses,
            NetIncome = netIncome
        };
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");

        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class IncomeStatementWebApiResponse
{
    public DateTime AsOfDate { get; set; }
    public List<IncomeStatementLineWebApiResponse> Revenues { get; set; } = new();
    public decimal TotalRevenue { get; set; }
    public List<IncomeStatementLineWebApiResponse> OperatingExpenses { get; set; } = new();
    public decimal TotalOperatingExpenses { get; set; }
    public decimal OperatingIncome { get; set; }
    public List<IncomeStatementLineWebApiResponse> OtherIncome { get; set; } = new();
    public decimal TotalOtherIncome { get; set; }
    public List<IncomeStatementLineWebApiResponse> OtherExpenses { get; set; } = new();
    public decimal TotalOtherExpenses { get; set; }
    public decimal NetIncome { get; set; }
}

public class IncomeStatementLineWebApiResponse
{
    public int ReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}