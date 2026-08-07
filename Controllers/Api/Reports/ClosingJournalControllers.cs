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
[Route("api/mobile/reports/closing-journal")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class ClosingJournalControllers : ControllerBase
{
    private readonly AppDbContext _db;

    public ClosingJournalControllers(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /api/mobile/reports/closing-journal
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetClosingJournal()
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
                closingJournal = (object?)null
            });
        }

        var rows = await TrialBalanceControllers.BuildTrialBalanceRowsAsync(_db, userId, period, includeAdjusting: true);
        var incomeStatement = IncomeStatementControllers.BuildIncomeStatement(rows, period);
        var reAccountName = rows.Find(r => r.Role == "RetainedEarnings")?.AccountName ?? "Retained Earnings";
        const string incomeSummaryName = "Income Summary";

        var groups = new List<ClosingJournalEntryGroupApiResponse>();

        var incomeRows = rows.Where(r => r.Type == "OperatingIncome" || r.Type == "OtherIncome").Where(r => r.NetBalance != 0).ToList();
        var expenseRows = rows.Where(r => r.Type == "OperatingExpenses" || r.Type == "OtherExpenses").Where(r => r.NetBalance != 0).ToList();

        // BLOCK 1: Closing Revenues to Income Summary
        if (incomeRows.Any())
        {
            var group1 = new ClosingJournalEntryGroupApiResponse { Description = "Closing Revenue Accounts to Income Summary" };
            foreach (var r in incomeRows)
            {
                group1.Lines.Add(new ClosingJournalLineApiResponse
                {
                    ReferenceNumber = r.ReferenceNumber,
                    AccountName = r.AccountName,
                    Debit = r.NetBalance,
                    Credit = 0m
                });
            }
            group1.Lines.Add(new ClosingJournalLineApiResponse
            {
                ReferenceNumber = 0,
                AccountName = incomeSummaryName,
                Debit = 0m,
                Credit = incomeRows.Sum(r => r.NetBalance)
            });
            groups.Add(group1);
        }

        // BLOCK 2: Closing Expenses to Income Summary
        if (expenseRows.Any())
        {
            var group2 = new ClosingJournalEntryGroupApiResponse { Description = "Closing Expense Accounts to Income Summary" };
            group2.Lines.Add(new ClosingJournalLineApiResponse
            {
                ReferenceNumber = 0,
                AccountName = incomeSummaryName,
                Debit = expenseRows.Sum(r => r.NetBalance),
                Credit = 0m
            });
            foreach (var r in expenseRows)
            {
                group2.Lines.Add(new ClosingJournalLineApiResponse
                {
                    ReferenceNumber = r.ReferenceNumber,
                    AccountName = r.AccountName,
                    Debit = 0m,
                    Credit = r.NetBalance
                });
            }
            groups.Add(group2);
        }

        // BLOCK 3: Closing Income Summary to Retained Earnings
        if (incomeStatement.NetIncome != 0)
        {
            var group3 = new ClosingJournalEntryGroupApiResponse { Description = "Closing Income Summary to Retained Earnings" };

            if (incomeStatement.NetIncome > 0)
            {
                group3.Lines.Add(new ClosingJournalLineApiResponse
                {
                    ReferenceNumber = 0,
                    AccountName = incomeSummaryName,
                    Debit = incomeStatement.NetIncome,
                    Credit = 0m
                });
                group3.Lines.Add(new ClosingJournalLineApiResponse
                {
                    ReferenceNumber = 0,
                    AccountName = reAccountName,
                    Debit = 0m,
                    Credit = incomeStatement.NetIncome
                });
            }
            else
            {
                var netLoss = Math.Abs(incomeStatement.NetIncome);
                group3.Lines.Add(new ClosingJournalLineApiResponse
                {
                    ReferenceNumber = 0,
                    AccountName = reAccountName,
                    Debit = netLoss,
                    Credit = 0m
                });
                group3.Lines.Add(new ClosingJournalLineApiResponse
                {
                    ReferenceNumber = 0,
                    AccountName = incomeSummaryName,
                    Debit = 0m,
                    Credit = netLoss
                });
            }

            groups.Add(group3);
        }

        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = period.PeriodName,
            closingJournal = new
            {
                netIncome = incomeStatement.NetIncome,
                retainedEarningsAccountName = reAccountName,
                groups = groups
            }
        });
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class ClosingJournalEntryGroupApiResponse
{
    public string Description { get; set; } = string.Empty;
    public List<ClosingJournalLineApiResponse> Lines { get; set; } = new();
    public decimal TotalDebit => Lines.Sum(l => l.Debit);
    public decimal TotalCredit => Lines.Sum(l => l.Credit);
}

public class ClosingJournalLineApiResponse
{
    public int ReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}
