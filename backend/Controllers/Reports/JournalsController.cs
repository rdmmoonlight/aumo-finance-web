using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoBackend.Models;
using AumoBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoBackend.Controllers.Reports;

[ApiController]
[Route("/api/v1/reports/journals")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class JournalController : ControllerBase
{
    private readonly AppDbContext _db;

    public JournalController(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GENERAL JOURNAL
    // GET: /api/v1/reports/journals/general
    // ==========================================
    [HttpGet("general")]
    public async Task<IActionResult> GetGeneralJournal()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        var selectedPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
        if (selectedPeriod == null)
        {
            return NotFound(new
            {
                success = false,
                hasPeriodSelected = false,
                message = "No accounting period selected.",
                selectedPeriodName = (string?)null,
                isPeriodClosed = false,
                entries = Array.Empty<object>()
            });
        }

        // Pengoptimalan kueri tanggal agar mendukung PostgreSQL Index Scan
        var startUtc = selectedPeriod.StartDate.Date;
        var endUtc = selectedPeriod.EndDate.Date.AddDays(1).AddTicks(-1);

        var entries = await _db.JournalEntries
            .Include(j => j.Lines)
                .ThenInclude(l => l.Account)
            .Where(j => j.UserId == userId
                     && j.JournalType == "General"
                     && j.EntryDate >= startUtc
                     && j.EntryDate <= endUtc)
            .OrderBy(j => j.EntryDate)
            .ThenBy(j => j.CreatedAt)
            .ThenBy(j => j.Id)
            .Select(j => new
            {
                j.Id,
                j.TransactionNumber,
                j.JournalType,
                EntryDate = j.EntryDate.ToString("yyyy-MM-dd"),
                j.CreatedAt,
                j.UpdatedAt,
                lines = j.Lines.OrderBy(l => l.LineOrder).Select(l => new
                {
                    l.Id,
                    l.AccountId,
                    AccountName = l.Account != null ? l.Account.AccountName : "Unknown",
                    ReferenceNumber = l.Account != null ? l.Account.ReferenceNumber : 0,
                    l.LineDescription,
                    l.Debit,
                    l.Credit,
                    l.LineOrder
                })
            })
            .ToListAsync();

        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = selectedPeriod.PeriodName,
            isPeriodClosed = selectedPeriod.IsClosed,
            entries = entries
        });
    }

    // ==========================================
    // 2. ADJUSTING JOURNAL
    // GET: /api/v1/reports/journals/adjusting
    // ==========================================
    [HttpGet("adjusting")]
    public async Task<IActionResult> GetAdjustingJournal()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        var selectedPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
        if (selectedPeriod == null)
        {
            return Ok(new
            {
                success = true,
                hasPeriodSelected = false,
                message = "No accounting period selected.",
                selectedPeriodName = (string?)null,
                isPeriodClosed = false,
                entries = Array.Empty<object>()
            });
        }

        // Pengoptimalan kueri tanggal untuk PostgreSQL Index Scan
        var startUtc = selectedPeriod.StartDate.Date;
        var endUtc = selectedPeriod.EndDate.Date.AddDays(1).AddTicks(-1);

        var entries = await _db.JournalEntries
            .Include(j => j.Lines)
                .ThenInclude(l => l.Account)
            .Where(j => j.UserId == userId
                     && j.JournalType == "Adjusting"
                     && j.EntryDate >= startUtc
                     && j.EntryDate <= endUtc)
            .OrderBy(j => j.EntryDate)
            .ThenBy(j => j.CreatedAt)
            .ThenBy(j => j.Id)
            .Select(j => new
            {
                j.Id,
                j.TransactionNumber,
                j.JournalType,
                j.EntryDate,
                j.CreatedAt,
                j.UpdatedAt,
                lines = j.Lines.OrderBy(l => l.LineOrder).Select(l => new
                {
                    l.Id,
                    l.AccountId,
                    AccountName = l.Account != null ? l.Account.AccountName : "Unknown",
                    ReferenceNumber = l.Account != null ? l.Account.ReferenceNumber : 0,
                    l.LineDescription,
                    l.Debit,
                    l.Credit,
                    l.LineOrder
                })
            })
            .ToListAsync();

        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = selectedPeriod.PeriodName,
            isPeriodClosed = selectedPeriod.IsClosed,
            entries = entries
        });
    }

    // DELETE: /api/v1/reports/journals/adjusting/{id}
    [HttpDelete("adjusting/{id:int}")]
    public async Task<IActionResult> DeleteAdjustingJournal(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        var entry = await _db.JournalEntries
            .FirstOrDefaultAsync(j => j.Id == id && j.UserId == userId && j.JournalType == "Adjusting");

        if (entry == null)
        {
            return NotFound(new { success = false, message = "Adjusting journal entry not found." });
        }

        var selectedPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
        if (selectedPeriod != null && selectedPeriod.IsClosed)
        {
            return BadRequest(new { success = false, message = "Cannot delete entry in a closed accounting period." });
        }

        _db.JournalEntries.Remove(entry);
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Adjusting journal entry deleted successfully." });
    }

    // ==========================================
    // 3. CLOSING JOURNAL
    // GET: /api/v1/reports/journals/closing
    // ==========================================
    [HttpGet("closing")]
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
        var incomeStatement = IncomeStatementController.BuildIncomeStatement(rows, period);
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