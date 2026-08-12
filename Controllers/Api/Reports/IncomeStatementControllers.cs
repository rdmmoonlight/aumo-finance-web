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
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Controllers.Api.Reports;

[ApiController]
[Route("api/mobile/reports/income-statement")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class IncomeStatementControllers : ControllerBase
{
    private readonly AppDbContext _db;

    public IncomeStatementControllers(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /api/mobile/reports/income-statement
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetIncomeStatement()
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
                revenueAccounts = Array.Empty<object>(),
                expenseAccounts = Array.Empty<object>()
            });
        }

        var rows = await TrialBalanceControllers.BuildTrialBalanceRowsAsync(_db, userId, period, includeAdjusting: true);
        var statementData = BuildIncomeStatement(rows, period);

        // Kontrak response harus flat (field-field di root), selaras dengan pola
        // TrialBalanceControllers/WorksheetControllers, dan nama field harus sama
        // persis dengan IncomeStatementReportApiResponse di sisi Android
        // (revenueAccounts/totalRevenue/expenseAccounts/totalExpenses/netIncome),
        // ditambah otherIncomeAccounts/otherExpenseAccounts/operatingIncome yang
        // sebelumnya tidak pernah dikirim sama sekali.
        // Sebelumnya di-nest di bawah properti "incomeStatement" dengan nama field
        // berbeda (revenues, operatingExpenses, totalOperatingExpenses), sehingga
        // Android selalu mendapat daftar akun kosong dan total Rp 0.
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

    public static IncomeStatementApiResponse BuildIncomeStatement(List<TrialBalanceRow> rows, Period period)
    {
        IncomeStatementLineApiResponse ToLine(TrialBalanceRow r) => new()
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

        return new IncomeStatementApiResponse
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
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class IncomeStatementApiResponse
{
    public DateTime AsOfDate { get; set; }
    public List<IncomeStatementLineApiResponse> Revenues { get; set; } = new();
    public decimal TotalRevenue { get; set; }
    public List<IncomeStatementLineApiResponse> OperatingExpenses { get; set; } = new();
    public decimal TotalOperatingExpenses { get; set; }
    public decimal OperatingIncome { get; set; }
    public List<IncomeStatementLineApiResponse> OtherIncome { get; set; } = new();
    public decimal TotalOtherIncome { get; set; }
    public List<IncomeStatementLineApiResponse> OtherExpenses { get; set; } = new();
    public decimal TotalOtherExpenses { get; set; }
    public decimal NetIncome { get; set; }
}

public class IncomeStatementLineApiResponse
{
    public int ReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}
