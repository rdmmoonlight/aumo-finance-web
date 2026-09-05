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
[Route("api/mobile/reports/general-ledger")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class GeneralLedgerControllers : ControllerBase
{
    private readonly AppDbContext _db;

    public GeneralLedgerControllers(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /api/mobile/reports/general-ledger?isTemporary=false
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetGeneralLedger([FromQuery] bool isTemporary = false)
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
                isTemporary = isTemporary,
                netIncomeBeforeClosing = 0m,
                ledgers = Array.Empty<object>()
            });
        }

        Func<string, bool> typeFilter = isTemporary
            ? AccountClassification.IsTemporary
            : AccountClassification.IsPermanent;

        var ledgers = await BuildLedgersAsync(userId, period, typeFilter, isTemporary);

        decimal netTotal = 0m;
        if (isTemporary)
        {
            netTotal = ledgers.Sum(l => l.NormalBalanceIsDebit ? -l.EndingBalance : l.EndingBalance);
        }

        return Ok(new
        {
            success = true,
            hasPeriodSelected = true,
            selectedPeriodName = period.PeriodName,
            isTemporary = isTemporary,
            netIncomeBeforeClosing = netTotal,
            ledgers = ledgers
        });
    }

    private async Task<List<LedgerAccountApiResponse>> BuildLedgersAsync(Guid userId, Period period, Func<string, bool> typeFilter, bool isTemporary)
    {
        var accounts = (await _db.ChartOfAccounts
                .Where(a => a.IsActive && a.UserId == userId)
                .OrderBy(a => a.ReferenceNumber)
                .ToListAsync())
            .Where(a => typeFilter(a.Type))
            .ToList();

        var accountIds = accounts.Select(a => a.Id).ToList();

        var lines = await _db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Where(l => accountIds.Contains(l.AccountId) && l.JournalEntry!.UserId == userId)
            .OrderBy(l => l.JournalEntry!.EntryDate)
            .ThenBy(l => l.JournalEntry!.Id)
            .ThenBy(l => l.LineOrder)
            .ToListAsync();

        var result = new List<LedgerAccountApiResponse>();

        foreach (var account in accounts)
        {
            var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);
            decimal running = 0;

            var accountLines = lines.Where(l => l.AccountId == account.Id
                && l.JournalEntry!.EntryDate >= period.StartDate
                && l.JournalEntry!.EntryDate <= period.EndDate);

            var ledgerLines = new List<LedgerLineApiResponse>();
            foreach (var line in accountLines)
            {
                running += normalDebit ? (line.Debit - line.Credit) : (line.Credit - line.Debit);
                ledgerLines.Add(new LedgerLineApiResponse
                {
                    JournalEntryId = line.JournalEntryId,
                    EntryDate = line.JournalEntry!.EntryDate,
                    Description = line.LineDescription,
                    Debit = line.Debit,
                    Credit = line.Credit,
                    RunningBalance = running
                });
            }

            // Periode sudah ditutup: hitung ayat penutup di sini saja
            // (tidak disimpan ke tabel JournalEntry/JournalEntryLine).
            // Tampilkan sebagai baris paling bawah supaya saldo akhir
            // akun sementara ini menjadi 0.
            if (isTemporary && period.IsClosed && running != 0)
            {
                // Menutup saldo ke 0: posting di sisi berlawanan dari sisi
                // normalnya sebesar `running` (atau sisi yang sama bila
                // `running` kebetulan berlawanan/negatif).
                var closingDebit = normalDebit ? Math.Max(-running, 0) : Math.Max(running, 0);
                var closingCredit = normalDebit ? Math.Max(running, 0) : Math.Max(-running, 0);
                running = 0m;

                ledgerLines.Add(new LedgerLineApiResponse
                {
                    JournalEntryId = 0,
                    EntryDate = period.EndDate,
                    Description = "closing journal",
                    Debit = closingDebit,
                    Credit = closingCredit,
                    RunningBalance = running
                });
            }

            result.Add(new LedgerAccountApiResponse
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
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class LedgerAccountApiResponse
{
    public int AccountId { get; set; }
    public int ReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool NormalBalanceIsDebit { get; set; }
    public decimal EndingBalance { get; set; }
    public List<LedgerLineApiResponse> Lines { get; set; } = new();
}

public class LedgerLineApiResponse
{
    public int JournalEntryId { get; set; }
    public DateTime EntryDate { get; set; }
    public string? Description { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public decimal RunningBalance { get; set; }
}
