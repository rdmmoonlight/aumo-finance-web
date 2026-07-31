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

    // 1. Endpoint Dashboard Real Data.
    // Catatan: dashboard tetap membaca dari tabel utama (JournalEntries),
    // karena hanya menampilkan data yang SUDAH terverifikasi/terposting.
    // Transaksi mobile yang masih Pending tidak memengaruhi saldo apa pun.
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        var activePeriod = await _db.Periods
            .Where(p => !p.IsClosed)
            .OrderByDescending(p => p.StartDate)
            .FirstOrDefaultAsync();

        var accounts = await _db.ChartOfAccounts
            .Where(a => a.IsActive)
            .ToListAsync();

        var lines = await _db.JournalEntryLines
            .Include(l => l.JournalEntry)
            .Include(l => l.Account)
            .Where(l => l.JournalEntry != null)
            .ToListAsync();

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

        var pendingCount = await _db.MobileJournalEntries
            .Where(m => m.Status == "Pending")
            .CountAsync();

        return Ok(new
        {
            TotalCash = totalCash,
            Revenue = revenue,
            Expenses = expenses,
            NetIncome = netIncome,
            ActivePeriod = activePeriod?.PeriodName ?? "-",
            PendingVerification = pendingCount
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
    // Jurnal manual (akun dipilih sendiri di Android). TIDAK langsung masuk
    // JournalEntries — disimpan dulu ke MobileJournalEntries/Lines dengan
    // Status = Pending, menunggu di-approve lewat halaman Mobile Classification.
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

        var mobileEntry = new MobileJournalEntry
        {
            EntryDate = DateTime.SpecifyKind(dto.EntryDate == default ? DateTime.Today : dto.EntryDate, DateTimeKind.Utc),
            Mode = "Manual",
            Status = "Pending",
            SubmittedAt = DateTime.UtcNow,
            Lines = lines.Select((l, index) => new MobileJournalEntryLine
            {
                AccountId = l.AccountId,
                LineDescription = l.LineDescription,
                Debit = l.Debit,
                Credit = l.Credit,
                LineOrder = index
            }).ToList()
        };

        _db.MobileJournalEntries.Add(mobileEntry);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Jurnal berhasil dikirim, menunggu verifikasi.", mobileEntryId = mobileEntry.Id });
    }

    // POST: api/mobile/simple-transaction
    // Input cepat dari Android (Pemasukan/Pengeluaran, tanpa picker akun).
    // TIDAK langsung masuk JournalEntries — disimpan ke MobileJournalEntries
    // dengan Status = Pending, menunggu diklasifikasikan ke akun yang sesuai
    // lewat halaman Mobile Classification.
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

        var mobileEntry = new MobileJournalEntry
        {
            EntryDate = DateTime.SpecifyKind(dto.EntryDate == default ? DateTime.Today : dto.EntryDate, DateTimeKind.Utc),
            Mode = "Simple",
            Type = dto.Type,
            Amount = dto.Amount,
            Note = dto.Note,
            Status = "Pending",
            SubmittedAt = DateTime.UtcNow
        };

        _db.MobileJournalEntries.Add(mobileEntry);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Transaksi berhasil dikirim, menunggu verifikasi.", mobileEntryId = mobileEntry.Id });
    }

    // Sama persis dengan JournalEntryController.GenerateReferenceNumberAsync,
    // supaya penomoran referensi konsisten antara input via web dan via mobile
    // yang sudah diverifikasi. Dipakai oleh MobileClassificationController
    // saat memposting entri terverifikasi ke JournalEntries.
    internal static async Task<string> GenerateReferenceNumberAsync(AppDbContext db, string journalType)
    {
        var prefix = journalType == "Adjusting" ? "AJE" : "GJ";

        var lastNumber = await db.JournalEntries
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
