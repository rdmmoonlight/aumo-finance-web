using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/mobile")]
public class MobileApiController : ControllerBase
{
    private readonly AppDbContext _db;

    public MobileApiController(AppDbContext db)
    {
        _db = db;
    }

    // 1. Endpoint Dashboard Real Data
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        // 1. Periode aktif (sama seperti DashboardController versi web)
        var activePeriod = await _db.Periods
            .Where(p => !p.IsClosed)
            .OrderByDescending(p => p.StartDate)
            .FirstOrDefaultAsync();

        // 2. Semua akun aktif + seluruh baris jurnal
        var accounts = await _db.ChartOfAccounts
            .Where(a => a.IsActive)
            .ToListAsync();

        var lines = await _db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Include(l => l.Account)
            .Where(l => l.JournalEntry != null)
            .ToListAsync();

        // 3. Saldo bersih tiap akun (aturan sama dengan ReportsController/DashboardController)
        var accountBalances = new Dictionary<int, decimal>();
        foreach (var account in accounts)
        {
            var normalDebit = AccountClassification.NormalBalanceIsDebit(account.Type);
            var accountLines = lines.Where(l => l.AccountId == account.Id);
            var net = normalDebit
                ? accountLines.Sum(l => l.Debit - l.Credit)
                : accountLines.Sum(l => l.Credit - l.Debit);
            accountBalances[account.Id] = net;
        }

        var totalCash = accounts
            .Where(a => a.Role == "CashAndEquivalents")
            .Sum(a => accountBalances.GetValueOrDefault(a.Id));

        // Revenue & Expenses dibatasi ke periode aktif bila ada
        IEnumerable<JournalEntryLine> periodLines = lines;
        if (activePeriod != null)
        {
            periodLines = lines.Where(l =>
                l.JournalEntry!.EntryDate >= activePeriod.StartDate &&
                l.JournalEntry!.EntryDate <= activePeriod.EndDate);
        }

        decimal SumByType(string type)
        {
            var ids = accounts.Where(a => a.Type == type).Select(a => a.Id).ToHashSet();
            var normalDebit = AccountClassification.NormalBalanceIsDebit(type);
            var relevant = periodLines.Where(l => ids.Contains(l.AccountId));
            return normalDebit
                ? relevant.Sum(l => l.Debit - l.Credit)
                : relevant.Sum(l => l.Credit - l.Debit);
        }

        var revenue = SumByType("OperatingIncome") + SumByType("OtherIncome");
        var expenses = SumByType("OperatingExpenses") + SumByType("OtherExpenses");
        var netIncome = revenue - expenses;

        return Ok(new
        {
            TotalCash = totalCash,
            Revenue = revenue,
            Expenses = expenses,
            NetIncome = netIncome,
            ActivePeriod = activePeriod?.PeriodName ?? "-"
        });
    }

    // GET: api/mobile/accounts
    [HttpGet("accounts")]
    public async Task<IActionResult> GetAccounts()
    {
        var accounts = await _db.ChartOfAccounts
            .Where(a => a.IsActive)
            .OrderBy(a => a.ReferenceNumber)
            .Select(a => new
            {
                Id = a.Id,
                AccountName = a.AccountName,
                ReferenceNumber = a.ReferenceNumber
            })
            .ToListAsync();

        return Ok(accounts);
    }

    // POST: api/mobile/journal
    [HttpPost("journal")]
    public async Task<IActionResult> PostJournal([FromBody] MobileCreateJournalDto dto)
    {
        var lines = (dto.Lines ?? new List<MobileCreateJournalLineDto>())
            .Where(l => l.AccountId != 0 && (l.Debit != 0 || l.Credit != 0))
            .ToList();

        if (lines.Count < 2)
        {
            return BadRequest(new { message = "Jurnal harus memiliki minimal dua baris." });
        }

        var totalDebit = lines.Sum(l => l.Debit);
        var totalCredit = lines.Sum(l => l.Credit);

        if (totalDebit != totalCredit || totalDebit == 0)
        {
            return BadRequest(new { message = $"Total Debit (Rp {totalDebit:N0}) dan Kredit (Rp {totalCredit:N0}) harus seimbang." });
        }

        var validAccountIds = (await _db.ChartOfAccounts.Where(a => a.IsActive).Select(a => a.Id).ToListAsync())
            .ToHashSet();
        if (lines.Any(l => !validAccountIds.Contains(l.AccountId)))
        {
            return BadRequest(new { message = "Salah satu akun yang dipilih tidak valid atau tidak aktif." });
        }

        // Input dari mobile selalu jurnal umum (General); jenis Adjusting hanya dibuat lewat web.
        const string journalType = "General";
        var referenceNumber = await GenerateReferenceNumberAsync(journalType);

        var entry = new JournalEntry
        {
            ReferenceNumber = referenceNumber,
            JournalType = journalType,
            EntryDate = DateTime.SpecifyKind(dto.EntryDate == default ? DateTime.Today : dto.EntryDate, DateTimeKind.Utc),
            Lines = lines.Select((l, index) => new JournalEntryLine
            {
                AccountId = l.AccountId,
                LineDescription = l.LineDescription,
                Debit = l.Debit,
                Credit = l.Credit,
                LineOrder = index
            }).ToList()
        };

        _db.JournalEntries.Add(entry);
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Jurnal {entry.ReferenceNumber} berhasil disimpan." });
    }

    // POST: api/mobile/simple-transaction
    // Input cepat dari Android (Pemasukan/Pengeluaran saja, tanpa picker akun).
    // Server yang membentuk dua baris jurnal seimbang: Kas <-> Unclassified.
    [HttpPost("simple-transaction")]
    public async Task<IActionResult> PostSimpleTransaction([FromBody] MobileSimpleTransactionDto dto)
    {
        if (dto.Amount <= 0)
        {
            return BadRequest(new { message = "Nominal harus lebih besar dari 0." });
        }

        if (dto.Type != "Income" && dto.Type != "Expense")
        {
            return BadRequest(new { message = "Jenis transaksi tidak valid. Gunakan 'Income' atau 'Expense'." });
        }

        var cashAccount = await _db.ChartOfAccounts
            .Where(a => a.IsActive && a.Role == "CashAndEquivalents")
            .OrderBy(a => a.ReferenceNumber)
            .FirstOrDefaultAsync();

        if (cashAccount == null)
        {
            return BadRequest(new { message = "Akun Kas (Role = CashAndEquivalents) belum tersedia di Chart of Accounts." });
        }

        var unclassifiedRole = dto.Type == "Income" ? "UnclassifiedIncome" : "UnclassifiedExpense";
        var unclassifiedAccount = await _db.ChartOfAccounts
            .Where(a => a.IsActive && a.Role == unclassifiedRole)
            .OrderBy(a => a.ReferenceNumber)
            .FirstOrDefaultAsync();

        if (unclassifiedAccount == null)
        {
            return BadRequest(new { message = $"Akun sistem dengan Role = {unclassifiedRole} belum tersedia di Chart of Accounts." });
        }

        // Pemasukan: Kas (Debit) <-> Unclassified Income (Kredit)
        // Pengeluaran: Unclassified Expense (Debit) <-> Kas (Kredit)
        var lines = dto.Type == "Income"
            ? new List<JournalEntryLine>
              {
                  new() { AccountId = cashAccount.Id, LineDescription = dto.Note, Debit = dto.Amount, Credit = 0, LineOrder = 0 },
                  new() { AccountId = unclassifiedAccount.Id, LineDescription = dto.Note, Debit = 0, Credit = dto.Amount, LineOrder = 1 }
              }
            : new List<JournalEntryLine>
              {
                  new() { AccountId = unclassifiedAccount.Id, LineDescription = dto.Note, Debit = dto.Amount, Credit = 0, LineOrder = 0 },
                  new() { AccountId = cashAccount.Id, LineDescription = dto.Note, Debit = 0, Credit = dto.Amount, LineOrder = 1 }
              };

        const string journalType = "General";
        var referenceNumber = await GenerateReferenceNumberAsync(journalType);

        var entry = new JournalEntry
        {
            ReferenceNumber = referenceNumber,
            JournalType = journalType,
            EntryDate = DateTime.SpecifyKind(dto.EntryDate == default ? DateTime.Today : dto.EntryDate, DateTimeKind.Utc),
            NeedsClassification = true,
            Source = "Mobile",
            MobileNote = dto.Note,
            Lines = lines
        };

        _db.JournalEntries.Add(entry);
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Transaksi {entry.ReferenceNumber} berhasil disimpan.", referenceNumber = entry.ReferenceNumber });
    }

    // Sama persis dengan JournalEntryController.GenerateReferenceNumberAsync,
    // supaya penomoran referensi konsisten antara input via web dan via mobile.
    private async Task<string> GenerateReferenceNumberAsync(string journalType)
    {
        var prefix = journalType == "Adjusting" ? "AJE" : "GJ";

        var lastNumber = await _db.JournalEntries
            .Where(e => e.ReferenceNumber.StartsWith(prefix + "-"))
            .OrderByDescending(e => e.Id)
            .Select(e => e.ReferenceNumber)
            .FirstOrDefaultAsync();

        var nextSeq = 1;
        if (lastNumber != null)
        {
            var parts = lastNumber.Split('-');
            if (parts.Length == 2 && int.TryParse(parts[1], out var lastSeq))
            {
                nextSeq = lastSeq + 1;
            }
        }

        return $"{prefix}-{nextSeq:D6}";
    }
}

public class MobileCreateJournalDto
{
    public DateTime EntryDate { get; set; } = DateTime.Today;
    public List<MobileCreateJournalLineDto> Lines { get; set; } = new();
}

public class MobileCreateJournalLineDto
{
    public int AccountId { get; set; }
    public string? LineDescription { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}

public class MobileSimpleTransactionDto
{
    public DateTime EntryDate { get; set; } = DateTime.Today;

    // "Income" atau "Expense"
    public string Type { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string? Note { get; set; }
}
