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
[Route("web/reports/closing-journal")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class ClosingJournalWebController : ControllerBase
{
    private readonly AppDbContext _db;

    public ClosingJournalWebController(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /web/reports/closing-journal
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetClosingJournal()
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
                closingJournal = (object?)null
            });
        }

        var rows = await TrialBalanceController.BuildTrialBalanceRowsAsync(_db, userId, period, includeAdjusting: true);
        var incomeStatement = IncomeStatementWebController.BuildIncomeStatement(rows, period);
        var reAccountName = rows.Find(r => r.Role == "RetainedEarnings")?.AccountName ?? "Retained Earnings";
        const string incomeSummaryName = "Income Summary";

        var groups = new List<ClosingJournalEntryGroupWebApiResponse>();

        var incomeRows = rows.Where(r => r.Type == "OperatingIncome" || r.Type == "OtherIncome").Where(r => r.NetBalance != 0).ToList();
        var expenseRows = rows.Where(r => r.Type == "OperatingExpenses" || r.Type == "OtherExpenses").Where(r => r.NetBalance != 0).ToList();

        // BLOCK 1: Closing Revenues to Income Summary
        if (incomeRows.Any())
        {
            var group1 = new ClosingJournalEntryGroupWebApiResponse { Description = "Closing Revenue Accounts to Income Summary" };
            foreach (var r in incomeRows)
            {
                group1.Lines.Add(new ClosingJournalLineWebApiResponse
                {
                    ReferenceNumber = r.ReferenceNumber,
                    AccountName = r.AccountName,
                    Debit = r.NetBalance,
                    Credit = 0m
                });
            }
            group1.Lines.Add(new ClosingJournalLineWebApiResponse
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
            var group2 = new ClosingJournalEntryGroupWebApiResponse { Description = "Closing Expense Accounts to Income Summary" };
            group2.Lines.Add(new ClosingJournalLineWebApiResponse
            {
                ReferenceNumber = 0,
                AccountName = incomeSummaryName,
                Debit = expenseRows.Sum(r => r.NetBalance),
                Credit = 0m
            });
            foreach (var r in expenseRows)
            {
                group2.Lines.Add(new ClosingJournalLineWebApiResponse
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
            var group3 = new ClosingJournalEntryGroupWebApiResponse { Description = "Closing Income Summary to Retained Earnings" };

            if (incomeStatement.NetIncome > 0)
            {
                group3.Lines.Add(new ClosingJournalLineWebApiResponse
                {
                    ReferenceNumber = 0,
                    AccountName = incomeSummaryName,
                    Debit = incomeStatement.NetIncome,
                    Credit = 0m
                });
                group3.Lines.Add(new ClosingJournalLineWebApiResponse
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
                group3.Lines.Add(new ClosingJournalLineWebApiResponse
                {
                    ReferenceNumber = 0,
                    AccountName = reAccountName,
                    Debit = netLoss,
                    Credit = 0m
                });
                group3.Lines.Add(new ClosingJournalLineWebApiResponse
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
                groups = groups.Select(g => new
                {
                    description = g.Description,
                    totalDebit = g.TotalDebit,
                    totalCredit = g.TotalCredit,
                    lines = g.Lines.Select(l => new
                    {
                        referenceNumber = l.ReferenceNumber,
                        accountName = l.AccountName,
                        debit = l.Debit,
                        credit = l.Credit
                    })
                })
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

public class ClosingJournalEntryGroupWebApiResponse
{
    public string Description { get; set; } = string.Empty;
    public List<ClosingJournalLineWebApiResponse> Lines { get; set; } = new();
    public decimal TotalDebit => Lines.Sum(l => l.Debit);
    public decimal TotalCredit => Lines.Sum(l => l.Credit);
}

public class ClosingJournalLineWebApiResponse
{
    public int ReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}