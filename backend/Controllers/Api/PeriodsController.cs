using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoFinance.Models;
using AumoFinance.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Controllers.Api;

[ApiController]
[Route("api/mobile/periods")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
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
    // 1. GET: /api/mobile/periods (Period List & Selection Status)
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetPeriods()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var periods = await _db.Periods
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.StartDate)
            .Select(p => new
            {
                p.Id,
                p.PeriodName,
                p.StartDate,
                p.EndDate,
                p.IsClosed
            })
            .ToListAsync();

        var selectedPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);

        return Ok(new
        {
            success = true,
            selectedPeriodId = selectedPeriod?.Id,
            periods = periods
        });
    }

    // ==========================================
    // 2. GET: /api/mobile/periods/open-info (Reference data for the Open
    //    New Period screen — tells the client whether this is the very
    //    first period (belum ada periode & akun permanen sama sekali) or a
    //    later period. Untuk kondisi kedua, langsung hitung & tampilkan
    //    saldo carry-forward akun permanen dari periode SEBELUMNYA — tidak
    //    ada lagi pemilihan akun manual oleh user.
    // ==========================================
    [HttpGet("open-info")]
    public async Task<IActionResult> GetOpenPeriodInfo()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var carryForwardAccounts = await GetCarryForwardAccountsAsync(userId);

        return Ok(new
        {
            success = true,
            // false = belum pernah ada periode sama sekali -> wajib daftar akun baru.
            // true  = sudah ada periode sebelumnya -> tampilkan akun permanennya, lanjutkan saldonya.
            hasExistingPermanentAccounts = carryForwardAccounts.Count > 0,
            carryForwardAccounts
        });
    }

    // Akun permanen (Assets/Liabilities/Equity) beserta saldo carry-forward-nya,
    // dihitung dari periode paling akhir yang sudah ada milik user ini — bukan
    // dari seluruh riwayat, karena tiap periode memang dibukukan terpisah
    // (persis seperti ChartOfAccountsController.GetAccounts menghitung saldo
    // akun hanya dari EntryDate dalam rentang periode yang sedang dipilih).
    private async Task<List<CarryForwardAccount>> GetCarryForwardAccountsAsync(Guid userId)
    {
        var previousPeriod = await _db.Periods
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.StartDate)
            .FirstOrDefaultAsync();

        if (previousPeriod == null) return new List<CarryForwardAccount>();

        var permanentAccounts = await _db.ChartOfAccounts
            .Where(a => a.UserId == userId && a.IsActive
                     && (a.Type == "Assets" || a.Type == "Liabilities" || a.Type == "Equity"))
            .OrderBy(a => a.ReferenceNumber)
            .ToListAsync();

        if (permanentAccounts.Count == 0) return new List<CarryForwardAccount>();

        var accountIds = permanentAccounts.Select(a => a.Id).ToList();

        var totals = await _db.JournalEntryLines
            .Where(j => accountIds.Contains(j.AccountId)
                     && j.JournalEntry != null
                     && j.JournalEntry.EntryDate >= previousPeriod.StartDate
                     && j.JournalEntry.EntryDate <= previousPeriod.EndDate)
            .GroupBy(j => j.AccountId)
            .Select(g => new { AccountId = g.Key, TotalDebit = g.Sum(j => j.Debit), TotalCredit = g.Sum(j => j.Credit) })
            .ToDictionaryAsync(x => x.AccountId);

        var result = new List<CarryForwardAccount>();
        foreach (var account in permanentAccounts)
        {
            decimal balance = 0;
            if (totals.TryGetValue(account.Id, out var t))
            {
                // Sama persis dengan ChartOfAccountsController.GetAccounts:
                // positif = sisi normal akun itu (Debit utk Assets, Credit utk Liabilities/Equity).
                balance = AccountClassification.NormalBalanceIsDebit(account.Type)
                    ? t.TotalDebit - t.TotalCredit
                    : t.TotalCredit - t.TotalDebit;
            }

            result.Add(new CarryForwardAccount
            {
                Id = account.Id,
                ReferenceNumber = account.ReferenceNumber,
                AccountName = account.AccountName,
                Type = account.Type,
                Balance = balance
            });
        }

        return result;
    }

    // ==========================================
    // 3. POST: /api/mobile/periods/create (Open New Period)
    //    - SetupMode = "CreateNew": dipakai saat belum ada periode sama
    //      sekali -> daftarkan akun Cash/Bank/Retained Earnings baru +
    //      posting jurnal saldo awal dari input user.
    //    - SetupMode = "LoadExisting": dipakai saat sudah ada periode
    //      sebelumnya -> ambil SEMUA akun permanen + saldo carry-forward
    //      dari periode sebelumnya (dihitung ulang di server, bukan dari
    //      client), lalu posting sebagai jurnal "Opening Balance" di
    //      periode baru — debit/kredit mengikuti sisi normal tiap akun.
    // ==========================================
    [HttpPost("create")]
    public async Task<IActionResult> CreatePeriod([FromBody] CreatePeriodRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

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

        var isLoadExisting = request.SetupMode == CreatePeriodRequest.ModeLoadExisting;

        if (!isLoadExisting)
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
                // Dihitung ulang di server (bukan menerima saldo dari client)
                // supaya tidak bisa dipalsukan / basi.
                var carryForwardAccounts = await GetCarryForwardAccountsAsync(userId);
                if (carryForwardAccounts.Count == 0)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { success = false, message = "No permanent accounts found from a previous period to carry forward." });
                }

                var newPeriod = new Period
                {
                    UserId = userId,
                    PeriodName = periodName,
                    StartDate = startDate,
                    EndDate = endDate,
                    IsClosed = false
                };
                _db.Periods.Add(newPeriod);
                await _db.SaveChangesAsync();

                var nonZeroAccounts = carryForwardAccounts.Where(a => a.Balance != 0).ToList();

                // Hanya posting jurnal kalau ada saldo yang perlu dibawa. Kalau
                // SEMUA akun permanen bersaldo nol (kasus jarang), periode baru
                // tetap terbuka tanpa jurnal Opening Balance.
                if (nonZeroAccounts.Count > 0)
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
                    foreach (var account in nonZeroAccounts)
                    {
                        var isDebitNormal = AccountClassification.NormalBalanceIsDebit(account.Type);
                        decimal debit = 0, credit = 0;

                        // account.Balance positif = sisi normal akun itu (lihat
                        // GetCarryForwardAccountsAsync). Negatif berarti saldo
                        // terbalik dari sisi normalnya (mis. bank overdraft).
                        if (account.Balance >= 0)
                        {
                            if (isDebitNormal) debit = account.Balance; else credit = account.Balance;
                        }
                        else
                        {
                            if (isDebitNormal) credit = -account.Balance; else debit = -account.Balance;
                        }

                        lines.Add(new JournalEntryLine
                        {
                            JournalEntryId = journalEntry.Id,
                            AccountId = account.Id,
                            Debit = debit,
                            Credit = credit,
                            LineDescription = "Opening Balance",
                            LineOrder = order++
                        });
                    }

                    _db.JournalEntryLines.AddRange(lines);
                    await _db.SaveChangesAsync();
                }

                await transaction.CommitAsync();

                return Ok(new
                {
                    success = true,
                    message = $"Period {newPeriod.PeriodName} has been opened successfully. Opening balances carried forward from the previous period.",
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
                    IsClosed = false
                };
                _db.Periods.Add(newPeriod);
                await _db.SaveChangesAsync();

                var cashBalance = request.CashBalance ?? 0;
                var bankBalance = request.BankBalance ?? 0;
                var totalOpeningBalance = cashBalance + bankBalance;

                // Hanya posting jurnal pembuka bila ada saldo awal. Tanggal
                // entry = tanggal 1 periode, sehingga selalu tampil paling
                // atas di General Journal (diurutkan berdasarkan EntryDate).
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
    // 3. POST: /api/mobile/periods/select/{id} (Set Active/Viewing)
    // ==========================================
    [HttpPost("select/{id}")]
    public async Task<IActionResult> SelectPeriod(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var entity = await _db.Periods.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
        if (entity == null)
            return NotFound(new { success = false, message = "Accounting period not found." });

        await SelectedPeriodHelper.SelectPeriodAsync(_db, userId, entity.Id);

        return Ok(new
        {
            success = true,
            message = $"Now viewing {entity.PeriodName}" + (entity.IsClosed ? " (Closed)." : ".")
        });
    }

    // ==========================================
    // 4. POST: /api/mobile/periods/clear-selection (Stop Viewing)
    // ==========================================
    [HttpPost("clear-selection")]
    public async Task<IActionResult> ClearSelection()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        await SelectedPeriodHelper.ClearSelectionAsync(_db, userId);

        return Ok(new
        {
            success = true,
            message = "Period selection cleared."
        });
    }

    // ==========================================
    // 5. POST: /api/mobile/periods/close/{id} (Close Period)
    // ==========================================
    [HttpPost("close/{id}")]
    public async Task<IActionResult> ClosePeriod(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var entity = await _db.Periods.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
        if (entity == null)
            return NotFound(new { success = false, message = "Accounting period not found." });

        if (entity.IsClosed)
            return BadRequest(new { success = false, message = $"Period {entity.PeriodName} is already closed." });

        // Validation: Cannot close period if an earlier period is still open
        var hasEarlierOpenPeriod = await _db.Periods
            .AnyAsync(p => p.UserId == userId && p.Id != entity.Id && p.StartDate < entity.StartDate && !p.IsClosed);

        if (hasEarlierOpenPeriod)
            return BadRequest(new { success = false, message = $"Cannot close {entity.PeriodName}: an earlier period is still open. Close earlier periods first." });

        // Catatan: tidak ada ayat jurnal penutup yang disimpan ke tabel
        // JournalEntry/JournalEntryLine di sini — tabel itu hanya untuk
        // General & Adjusting. Saldo akun sementara pasca-tutup dihitung
        // langsung (on-the-fly) di General Ledger Temporary, lihat
        // GeneralLedgerControllers.
        entity.IsClosed = true;
        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"Period {entity.PeriodName} has been closed. Transactions in this period are now locked."
        });
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class CarryForwardAccount
{
    public int Id { get; set; }
    public int ReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public decimal Balance { get; set; }
}

public class CreatePeriodRequest
{
    public const string ModeLoadExisting = "LoadExisting";
    public const string ModeCreateNew = "CreateNew";

    public int Month { get; set; }
    public int Year { get; set; }

    // "LoadExisting" (sudah ada periode sebelumnya -> akun permanen +
    // saldo carry-forward dihitung otomatis di server) atau "CreateNew"
    // (belum ada periode sama sekali -> akun permanen belum ada, harus
    // didaftarkan manual beserta saldo awalnya).
    public string SetupMode { get; set; } = ModeLoadExisting;

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
