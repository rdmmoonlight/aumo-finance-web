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

namespace AumoFinance.Controllers.Web;

[ApiController]
[Route("web/periods")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class PeriodsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITransactionNumberService _txNumberService;

    public PeriodsController(AppDbContext db, ITransactionNumberService txNumberService)
    {
        _db = db;
        _txNumberService = txNumberService;
    }

    // ==========================================
    // 1. GET: /web/periods (Period List & Selection Status)
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetPeriods()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        var periodsData = await _db.Periods
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.StartDate)
            .Select(p => new
            {
                p.Id,
                p.PeriodName,
                p.StartDate,
                p.EndDate,
                p.IsClosed,
                p.IsSelected
            })
            .ToListAsync();

        var selectedPeriod = periodsData.FirstOrDefault(p => p.IsSelected);
        int? selectedPeriodId = selectedPeriod?.Id;

        // Fallback ke helper jika di DB belum ada yang bernilai IsSelected = true
        if (!selectedPeriodId.HasValue)
        {
            var selectedFromHelper = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);
            selectedPeriodId = selectedFromHelper?.Id;
        }

        var periods = periodsData.Select(p => new
        {
            p.Id,
            p.PeriodName,
            p.StartDate,
            p.EndDate,
            p.IsClosed,
            IsSelected = selectedPeriodId.HasValue ? (p.Id == selectedPeriodId.Value) : p.IsSelected
        }).ToList();

        return Ok(new
        {
            success = true,
            selectedPeriodId = selectedPeriodId,
            periods = periods
        });
    }

    // ==========================================
    // 2. GET: /web/periods/open-info
    // ==========================================
    [HttpGet("open-info")]
    public async Task<IActionResult> GetOpenPeriodInfo()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        var accounts = await _db.ChartOfAccounts
            .Where(a => a.IsActive && a.UserId == userId)
            .OrderBy(a => a.ReferenceNumber)
            .ToListAsync();

        var permanentAccounts = accounts
            .Where(a => a.Type == "Assets" || a.Type == "Liabilities" || a.Type == "Equity")
            .Select(a => new { a.Id, a.ReferenceNumber, a.AccountName, a.Type, a.DisplayLabel })
            .ToList();

        var availableCashAndBank = accounts.Where(a => a.Role == "CashAndEquivalents")
            .Select(a => new { a.Id, a.ReferenceNumber, a.AccountName, a.DisplayLabel })
            .ToList();

        var availableRetainedEarnings = accounts.Where(a => a.Role == "RetainedEarnings")
            .Select(a => new { a.Id, a.ReferenceNumber, a.AccountName, a.DisplayLabel })
            .ToList();

        var hasExistingPermanentAccounts = availableCashAndBank.Any() && availableRetainedEarnings.Any();

        return Ok(new
        {
            success = true,
            hasExistingPermanentAccounts,
            availableCashAndBankAccounts = availableCashAndBank,
            availableRetainedEarningsAccounts = availableRetainedEarnings,
            permanentAccounts
        });
    }

    // ==========================================
    // 3. POST: /web/periods (Open New Period)
    // ==========================================
    [HttpPost]
    public async Task<IActionResult> CreatePeriod([FromBody] CreateWebPeriodRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        if (request.Month < 1 || request.Month > 12)
            return BadRequest(new { success = false, message = "Please select a valid month." });

        if (request.Year < 2000 || request.Year > 2100)
            return BadRequest(new { success = false, message = "Please provide a valid year." });

        var startDate = DateTime.SpecifyKind(new DateTime(request.Year, request.Month, 1), DateTimeKind.Utc);
        var endDate = startDate.AddMonths(1).AddDays(-1);
        var periodName = startDate.ToString("MMMM yyyy");

        var periodExists = await _db.Periods.AnyAsync(p => p.UserId == userId && p.StartDate == startDate);
        if (periodExists)
            return BadRequest(new { success = false, message = $"Period {periodName} already exists." });

        var isLoadExisting = request.SetupMode == CreateWebPeriodRequest.ModeLoadExisting;

        if (isLoadExisting)
        {
            if (request.CashAccountId == null || request.BankAccountId == null || request.RetainedEarningsAccountId == null)
                return BadRequest(new { success = false, message = "Please select the Cash, Bank, and Retained Earnings accounts to carry forward." });

            if (request.CashAccountId == request.BankAccountId)
                return BadRequest(new { success = false, message = "Cash Account and Bank Account cannot be the same account." });
        }
        else
        {
            if (string.IsNullOrWhiteSpace(request.CashAccountCode) || string.IsNullOrWhiteSpace(request.CashAccountName) ||
                string.IsNullOrWhiteSpace(request.BankAccountCode) || string.IsNullOrWhiteSpace(request.BankAccountName) ||
                string.IsNullOrWhiteSpace(request.RetainedEarningsAccountCode) || string.IsNullOrWhiteSpace(request.RetainedEarningsAccountName))
                return BadRequest(new { success = false, message = "Please complete all new account fields (reference code & name)." });

            if (!int.TryParse(request.CashAccountCode, out _) || !int.TryParse(request.BankAccountCode, out _) || !int.TryParse(request.RetainedEarningsAccountCode, out _))
                return BadRequest(new { success = false, message = "Account reference codes must be numeric." });
        }

        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            if (isLoadExisting)
            {
                var cashAccount = await _db.ChartOfAccounts.FirstOrDefaultAsync(a => a.Id == request.CashAccountId && a.UserId == userId);
                var bankAccount = await _db.ChartOfAccounts.FirstOrDefaultAsync(a => a.Id == request.BankAccountId && a.UserId == userId);
                var retainedAccount = await _db.ChartOfAccounts.FirstOrDefaultAsync(a => a.Id == request.RetainedEarningsAccountId && a.UserId == userId);

                if (cashAccount == null || bankAccount == null || retainedAccount == null)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { success = false, message = "One or more selected accounts could not be found." });
                }

                var newPeriod = new Period
                {
                    UserId = userId,
                    PeriodName = periodName,
                    StartDate = startDate,
                    EndDate = endDate,
                    IsClosed = false,
                    IsSelected = false
                };
                _db.Periods.Add(newPeriod);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    success = true,
                    message = $"Period {newPeriod.PeriodName} has been opened successfully. Balances carry forward from the ledger.",
                    periodId = newPeriod.Id
                });
            }
            else
            {
                var cashCode = int.Parse(request.CashAccountCode!);
                var bankCode = int.Parse(request.BankAccountCode!);
                var retainedCode = int.Parse(request.RetainedEarningsAccountCode!);

                var existingCodes = await _db.ChartOfAccounts
                    .Where(a => a.UserId == userId
                             && (a.ReferenceNumber == cashCode || a.ReferenceNumber == bankCode || a.ReferenceNumber == retainedCode))
                    .Select(a => a.ReferenceNumber)
                    .ToListAsync();

                if (existingCodes.Any())
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { success = false, message = "One or more account reference numbers are already in use in your Chart of Accounts." });
                }

                var cashAccount = new ChartOfAccount { UserId = userId, ReferenceNumber = cashCode, AccountName = request.CashAccountName!.Trim(), Type = "Assets", Role = "CashAndEquivalents", IsActive = true };
                var bankAccount = new ChartOfAccount { UserId = userId, ReferenceNumber = bankCode, AccountName = request.BankAccountName!.Trim(), Type = "Assets", Role = "CashAndEquivalents", IsActive = true };
                var retainedAccount = new ChartOfAccount { UserId = userId, ReferenceNumber = retainedCode, AccountName = request.RetainedEarningsAccountName!.Trim(), Type = "Equity", Role = "RetainedEarnings", IsActive = true };

                _db.ChartOfAccounts.AddRange(cashAccount, bankAccount, retainedAccount);
                await _db.SaveChangesAsync();

                var newPeriod = new Period
                {
                    UserId = userId,
                    PeriodName = periodName,
                    StartDate = startDate,
                    EndDate = endDate,
                    IsClosed = false,
                    IsSelected = false
                };
                _db.Periods.Add(newPeriod);
                await _db.SaveChangesAsync();

                var cashBalance = request.CashBalance ?? 0;
                var bankBalance = request.BankBalance ?? 0;
                var totalOpeningBalance = cashBalance + bankBalance;

                if (totalOpeningBalance != 0)
                {
                    var transactionNumber = await _txNumberService.GenerateAsync(userId, "General", startDate);

                    var journalEntry = new JournalEntry
                    {
                        UserId = userId,
                        TransactionNumber = transactionNumber,
                        JournalType = "General",
                        EntryDate = startDate,
                        CreatedAt = DateTime.UtcNow
                    };
                    _db.JournalEntries.Add(journalEntry);
                    await _db.SaveChangesAsync();

                    var lines = new List<JournalEntryLine>();
                    int order = 0;
                    if (cashBalance != 0)
                        lines.Add(new JournalEntryLine { JournalEntryId = journalEntry.Id, AccountId = cashAccount.Id, Debit = cashBalance, Credit = 0, LineDescription = "Opening balance", LineOrder = order++ });
                    if (bankBalance != 0)
                        lines.Add(new JournalEntryLine { JournalEntryId = journalEntry.Id, AccountId = bankAccount.Id, Debit = bankBalance, Credit = 0, LineDescription = "Opening balance", LineOrder = order++ });
                    lines.Add(new JournalEntryLine { JournalEntryId = journalEntry.Id, AccountId = retainedAccount.Id, Debit = 0, Credit = totalOpeningBalance, LineDescription = "Opening balance", LineOrder = order++ });

                    _db.JournalEntryLines.AddRange(lines);
                    await _db.SaveChangesAsync();
                }

                await transaction.CommitAsync();

                return Ok(new
                {
                    success = true,
                    message = $"Period {newPeriod.PeriodName} has been opened successfully.",
                    periodId = newPeriod.Id
                });
            }
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return StatusCode(500, new { success = false, message = $"Transaction failed: {ex.InnerException?.Message ?? ex.Message}" });
        }
    }

    // ==========================================
    // 4. POST: /web/periods/select/{id} (Set Active/Viewing)
    // ==========================================
    [HttpPost("select/{id:int}")]
    public async Task<IActionResult> SelectPeriod(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        var entity = await _db.Periods.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
        if (entity == null)
            return NotFound(new { success = false, message = "Accounting period not found." });

        // TAHAP 1: Reset SEMUA IsSelected milik user ini menjadi false
        // Hal ini menjamin tidak ada konflik pada IX_Periods_IsSelected_Unique saat update berjalan
        await _db.Periods
            .Where(p => p.UserId == userId && p.IsSelected)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsSelected, false));

        // TAHAP 2: Set HANYA 1 periode yang dipilih menjadi true
        await _db.Periods
            .Where(p => p.Id == id && p.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsSelected, true));

        // Sinkronisasi dengan helper session/cache
        await SelectedPeriodHelper.SelectPeriodAsync(_db, userId, entity.Id);

        return Ok(new
        {
            success = true,
            selectedPeriodId = entity.Id,
            message = $"Now viewing {entity.PeriodName}" + (entity.IsClosed ? " (Closed)." : ".")
        });
    }

    // ==========================================
    // 5. POST: /web/periods/clear-selection (Stop Viewing)
    // ==========================================
    [HttpPost("clear-selection")]
    public async Task<IActionResult> ClearSelection()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        // Set semua IsSelected milik user menjadi false
        await _db.Periods
            .Where(p => p.UserId == userId && p.IsSelected)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsSelected, false));

        await SelectedPeriodHelper.ClearSelectionAsync(_db, userId);

        return Ok(new
        {
            success = true,
            message = "Period selection cleared."
        });
    }

    // ==========================================
    // 6. POST: /web/periods/close/{id} (Close Period)
    // ==========================================
    [HttpPost("close/{id:int}")]
    public async Task<IActionResult> ClosePeriod(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { success = false, message = "User identity is invalid or expired." });

        var entity = await _db.Periods.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
        if (entity == null)
            return NotFound(new { success = false, message = "Accounting period not found." });

        if (entity.IsClosed)
            return BadRequest(new { success = false, message = $"Period {entity.PeriodName} is already closed." });

        var hasEarlierOpenPeriod = await _db.Periods
            .AnyAsync(p => p.UserId == userId && p.Id != entity.Id && p.StartDate < entity.StartDate && !p.IsClosed);

        if (hasEarlierOpenPeriod)
            return BadRequest(new { success = false, message = $"Cannot close {entity.PeriodName}: an earlier period is still open. Close earlier periods first." });

        // Ayat jurnal penutup: menutup semua akun sementara (General Ledger
        // Temporary) ke saldo 0, selisihnya dipindahkan ke Retained Earnings.
        // Tanggal = hari terakhir periode, deskripsi "closing journal".
        var closingEntry = await ClosingJournalPoster.BuildClosingEntryAsync(_db, userId, entity, _txNumberService);
        if (closingEntry != null)
        {
            _db.JournalEntries.Add(closingEntry);
        }

        entity.IsClosed = true;
        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"Period {entity.PeriodName} has been closed. Transactions in this period are now locked."
                + (closingEntry != null ? $" Closing journal {closingEntry.TransactionNumber} posted." : "")
        });
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");

        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class CreateWebPeriodRequest
{
    public const string ModeLoadExisting = "LoadExisting";
    public const string ModeCreateNew = "CreateNew";

    public int Month { get; set; }
    public int Year { get; set; }

    public string SetupMode { get; set; } = ModeLoadExisting;

    // --- MODE: LoadExisting ---
    public int? CashAccountId { get; set; }
    public int? BankAccountId { get; set; }
    public int? RetainedEarningsAccountId { get; set; }

    // --- MODE: CreateNew ---
    public string? CashAccountCode { get; set; }
    public string? CashAccountName { get; set; }
    public decimal? CashBalance { get; set; }

    public string? BankAccountCode { get; set; }
    public string? BankAccountName { get; set; }
    public decimal? BankBalance { get; set; }

    public string? RetainedEarningsAccountCode { get; set; }
    public string? RetainedEarningsAccountName { get; set; }
}
