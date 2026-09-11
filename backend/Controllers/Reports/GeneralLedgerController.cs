using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoBackend.Controllers.Reports;

[ApiController]
[Route("/api/v1/reports/general-ledger")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class GeneralLedgerController : ControllerBase
{
    private readonly AppDbContext _db;

    public GeneralLedgerController(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /api/v1/reports/general-ledger/permanent
    // ==========================================
    [HttpGet("permanent")]
    public async Task<IActionResult> GetPermanentGeneralLedger()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        var period = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
        if (period == null)
        {
            return NotFound(new
            {
                success = false,
                hasPeriodSelected = false,
                message = "No accounting period selected."
            });
        }

        var ledgers = await BuildLedgersAsync(userId, period, isTemporary: false);

        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = period.PeriodName,
            isTemporary = false,
            netIncomeBeforeClosing = 0m,
            ledgers = ledgers
        });
    }

    // ==========================================
    // 2. GET: /api/v1/reports/general-ledger/temporary
    // ==========================================
    [HttpGet("temporary")]
    public async Task<IActionResult> GetTemporaryGeneralLedger()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        var period = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
        if (period == null)
        {
            return NotFound(new
            {
                success = false,
                hasPeriodSelected = false,
                message = "No accounting period selected."
            });
        }

        var ledgers = await BuildLedgersAsync(userId, period, isTemporary: true);
        decimal netTotal = ledgers.Sum(l => l.NormalBalanceIsDebit ? -l.EndingBalance : l.EndingBalance);

        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = period.PeriodName,
            isTemporary = true,
            netIncomeBeforeClosing = netTotal,
            ledgers = ledgers
        });
    }

    private async Task<List<LedgerAccountResponse>> BuildLedgersAsync(Guid userId, Period period, bool isTemporary)
    {
        var allAccounts = await _db.ChartOfAccounts
            .Where(a => a.IsActive && a.UserId == userId)
            .OrderBy(a => a.ReferenceNumber)
            .ToListAsync();

        var accounts = isTemporary
            ? allAccounts.Where(a => AccountClassification.IsTemporary(a.Type)).ToList()
            : allAccounts.Where(a => AccountClassification.IsPermanent(a.Type)).ToList();

        var accountIds = accounts.Select(a => a.Id).ToList();

        var lines = await _db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Where(l => accountIds.Contains(l.AccountId) && l.JournalEntry!.UserId == userId)
            .OrderBy(l => l.JournalEntry!.EntryDate)
            .ThenBy(l => l.JournalEntry!.Id)
            .ThenBy(l => l.LineOrder)
            .ToListAsync();

        var result = new List<LedgerAccountResponse>();

        foreach (var account in accounts)
        {
            var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);
            decimal running = 0;

            var accountLines = lines.Where(l => l.AccountId == account.Id
                && l.JournalEntry!.EntryDate >= period.StartDate
                && l.JournalEntry!.EntryDate <= period.EndDate);

            var ledgerLines = new List<LedgerLineResponse>();
            foreach (var line in accountLines)
            {
                running += normalDebit ? (line.Debit - line.Credit) : (line.Credit - line.Debit);
                ledgerLines.Add(new LedgerLineResponse
                {
                    JournalEntryId = line.JournalEntryId,
                    EntryDate = line.JournalEntry!.EntryDate.ToString("yyyy-MM-dd"),
                    Description = line.LineDescription,
                    Debit = line.Debit,
                    Credit = line.Credit,
                    RunningBalance = running
                });
            }

            // Periode sudah ditutup untuk akun sementara (temporary)
            if (isTemporary && period.IsClosed && running != 0)
            {
                var closingDebit = normalDebit ? Math.Max(-running, 0) : Math.Max(running, 0);
                var closingCredit = normalDebit ? Math.Max(running, 0) : Math.Max(-running, 0);
                running = 0m;

                ledgerLines.Add(new LedgerLineResponse
                {
                    JournalEntryId = 0,
                    EntryDate = period.EndDate.ToString("yyyy-MM-dd"),
                    Description = "closing journal",
                    Debit = closingDebit,
                    Credit = closingCredit,
                    RunningBalance = running
                });
            }

            result.Add(new LedgerAccountResponse
            {
                AccountId = account.Id,
                ReferenceNumber = account.ReferenceNumber,
                AccountName = account.AccountName,
                Type = account.Type,
                NormalBalanceIsDebit = normalDebit,
                EndingBalance = running,
                Lines = ledgerLines
            });
        }

        return result;
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");

        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class LedgerAccountResponse
{
    public int AccountId { get; set; }
    public int ReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool NormalBalanceIsDebit { get; set; }
    public decimal EndingBalance { get; set; }
    public List<LedgerLineResponse> Lines { get; set; } = new();
}

public class LedgerLineResponse
{
    public int JournalEntryId { get; set; }
    public string EntryDate { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public decimal RunningBalance { get; set; }
}