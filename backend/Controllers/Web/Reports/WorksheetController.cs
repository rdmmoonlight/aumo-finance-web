using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoFinance.Models;
using AumoFinance.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Controllers.Web.Reports;

[ApiController]
[Route("web/reports/worksheet")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class WorksheetWebController : ControllerBase
{
    private readonly AppDbContext _db;

    public WorksheetWebController(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /web/reports/worksheet
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetWorksheet()
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
                rows = Array.Empty<object>(),
                totals = new { }
            });
        }

        var unadjusted = await TrialBalanceController.BuildTrialBalanceRowsAsync(_db, userId, period, includeAdjusting: false);
        var adjusted = await TrialBalanceController.BuildTrialBalanceRowsAsync(_db, userId, period, includeAdjusting: true);

        var accounts = await _db.ChartOfAccounts
            .Where(a => a.IsActive && a.UserId == userId)
            .OrderBy(a => a.ReferenceNumber)
            .ToListAsync();

        var worksheetRows = new List<WorksheetRowWebApiResponse>();
        var allAccountIds = unadjusted.Select(r => r.AccountId)
            .Union(adjusted.Select(r => r.AccountId))
            .ToList();

        foreach (var accountId in allAccountIds)
        {
            var account = accounts.FirstOrDefault(a => a.Id == accountId);
            if (account == null) continue;

            var u = unadjusted.FirstOrDefault(r => r.AccountId == accountId);
            var a = adjusted.FirstOrDefault(r => r.AccountId == accountId);
            var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);

            var uDebit = u?.Debit ?? 0m;
            var uCredit = u?.Credit ?? 0m;
            var aDebit = a?.Debit ?? 0m;
            var aCredit = a?.Credit ?? 0m;

            var adjNet = (aDebit - aCredit) - (uDebit - uCredit);

            var row = new WorksheetRowWebApiResponse
            {
                AccountId = accountId,
                ReferenceNumber = account.ReferenceNumber,
                AccountName = account.AccountName,
                Type = account.Type,
                NormalBalanceIsDebit = normalDebit,
                UnadjustedDebit = uDebit,
                UnadjustedCredit = uCredit,
                AdjustmentDebit = adjNet > 0 ? adjNet : 0m,
                AdjustmentCredit = adjNet < 0 ? -adjNet : 0m,
                AdjustedDebit = aDebit,
                AdjustedCredit = aCredit
            };

            var isTemporary = AccountClassification.IsTemporary(account.Type);
            if (isTemporary)
            {
                row.IncomeStatementDebit = aDebit;
                row.IncomeStatementCredit = aCredit;
            }
            else
            {
                row.FinancialPositionDebit = aDebit;
                row.FinancialPositionCredit = aCredit;
            }

            worksheetRows.Add(row);
        }

        worksheetRows = worksheetRows.OrderBy(r => r.ReferenceNumber).ToList();

        decimal totalUnadjustedDebit = worksheetRows.Sum(r => r.UnadjustedDebit);
        decimal totalUnadjustedCredit = worksheetRows.Sum(r => r.UnadjustedCredit);
        decimal totalAdjustmentDebit = worksheetRows.Sum(r => r.AdjustmentDebit);
        decimal totalAdjustmentCredit = worksheetRows.Sum(r => r.AdjustmentCredit);
        decimal totalAdjustedDebit = worksheetRows.Sum(r => r.AdjustedDebit);
        decimal totalAdjustedCredit = worksheetRows.Sum(r => r.AdjustedCredit);
        decimal totalIncomeStatementDebit = worksheetRows.Sum(r => r.IncomeStatementDebit);
        decimal totalIncomeStatementCredit = worksheetRows.Sum(r => r.IncomeStatementCredit);
        decimal totalFinancialPositionDebit = worksheetRows.Sum(r => r.FinancialPositionDebit);
        decimal totalFinancialPositionCredit = worksheetRows.Sum(r => r.FinancialPositionCredit);

        decimal netIncome = totalIncomeStatementCredit - totalIncomeStatementDebit;

        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = period.PeriodName,
            rows = worksheetRows.Select(r => new
            {
                accountId = r.AccountId,
                referenceNumber = r.ReferenceNumber,
                accountName = r.AccountName,
                type = r.Type,
                normalBalanceIsDebit = r.NormalBalanceIsDebit,
                tbDebit = r.UnadjustedDebit,
                tbCredit = r.UnadjustedCredit,
                adjDebit = r.AdjustmentDebit,
                adjCredit = r.AdjustmentCredit,
                adjTbDebit = r.AdjustedDebit,
                adjTbCredit = r.AdjustedCredit,
                isDebit = r.IncomeStatementDebit,
                isCredit = r.IncomeStatementCredit,
                bsDebit = r.FinancialPositionDebit,
                bsCredit = r.FinancialPositionCredit
            }),
            totals = new
            {
                tbDebit = totalUnadjustedDebit,
                tbCredit = totalUnadjustedCredit,
                adjDebit = totalAdjustmentDebit,
                adjCredit = totalAdjustmentCredit,
                adjTbDebit = totalAdjustedDebit,
                adjTbCredit = totalAdjustedCredit,
                isDebit = totalIncomeStatementDebit,
                isCredit = totalIncomeStatementCredit,
                bsDebit = totalFinancialPositionDebit,
                bsCredit = totalFinancialPositionCredit,
                netIncome = netIncome
            }
        });
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");

        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class WorksheetRowWebApiResponse
{
    public int AccountId { get; set; }
    public int ReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool NormalBalanceIsDebit { get; set; }

    public decimal UnadjustedDebit { get; set; }
    public decimal UnadjustedCredit { get; set; }

    public decimal AdjustmentDebit { get; set; }
    public decimal AdjustmentCredit { get; set; }

    public decimal AdjustedDebit { get; set; }
    public decimal AdjustedCredit { get; set; }

    public decimal IncomeStatementDebit { get; set; }
    public decimal IncomeStatementCredit { get; set; }

    public decimal FinancialPositionDebit { get; set; }
    public decimal FinancialPositionCredit { get; set; }
}