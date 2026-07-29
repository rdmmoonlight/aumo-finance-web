using AumoFinance.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/mobile")]
public class MobileApiController : ControllerBase
{
    private readonly AppDbContext _context;

    public MobileApiController(AppDbContext context)
    {
        _context = context;
    }

    // 1. Endpoint Dashboard Real Data
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        try
        {
            var totalCash = await _context.Accounts
                .Where(a => a.AccountType == "Cash" || a.AccountType == "Bank")
                .SumAsync(a => (decimal?)a.Balance) ?? 0m;

            var revenue = await _context.Accounts
                .Where(a => a.AccountType == "Revenue")
                .SumAsync(a => (decimal?)a.Balance) ?? 0m;

            var expenses = await _context.Accounts
                .Where(a => a.AccountType == "Expense")
                .SumAsync(a => (decimal?)a.Balance) ?? 0m;

            var netIncome = revenue - expenses;

            return Ok(new
            {
                totalCash = totalCash,
                revenue = revenue,
                expenses = expenses,
                netIncome = netIncome,
                activePeriod = DateTime.Now.ToString("yyyy-MM")
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error reading database", error = ex.Message });
        }
    }

    // 2. Endpoint Ambil Daftar Akun untuk Dropdown di Android
    [HttpGet("accounts")]
    public async Task<IActionResult> GetAccounts()
    {
        var accounts = await _context.Accounts
            .OrderBy(a => a.ReferenceNumber)
            .Select(a => new
            {
                id = a.Id,
                accountName = a.AccountName,
                referenceNumber = a.ReferenceNumber
            })
            .ToListAsync();

        return Ok(accounts);
    }

    // 3. Endpoint Simpan Jurnal Baru dari Android
    [HttpPost("journal")]
    public async Task<IActionResult> CreateJournal([FromBody] MobileJournalEntryDto dto)
    {
        if (dto == null || dto.Lines == null || dto.Lines.Count < 2)
        {
            return BadRequest(new { message = "Jurnal harus memiliki minimal 2 baris transaksi." });
        }

        // Validasi Balance (Debit == Credit)
        decimal totalDebit = dto.Lines.Sum(l => l.Debit);
        decimal totalCredit = dto.Lines.Sum(l => l.Credit);

        if (Math.Abs(totalDebit - totalCredit) > 0.001m)
        {
            return BadRequest(new { message = $"Jurnal tidak seimbang (Unbalanced)! Selisih: {Math.Abs(totalDebit - totalCredit):N2}" });
        }

        try
        {
            // Peta ke Entity Model Jurnal Web C#
            var journal = new JournalEntry
            {
                JournalType = dto.JournalType ?? "General",
                EntryDate = dto.EntryDate,
                CreatedAt = DateTime.UtcNow,
                Lines = dto.Lines.Select(l => new JournalEntryLine
                {
                    AccountId = l.AccountId,
                    LineDescription = l.LineDescription,
                    Debit = l.Debit,
                    Credit = l.Credit
                }).ToList()
            };

            _context.JournalEntries.Add(journal);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Jurnal berhasil disimpan!" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Gagal menyimpan jurnal ke database", error = ex.Message });
        }
    }
}

// DTO untuk Serialisasi JSON dari Android
public class MobileJournalEntryDto
{
    public string JournalType { get; set; } = "General";
    public DateTime EntryDate { get; set; } = DateTime.Today;
    public List<MobileJournalLineDto> Lines { get; set; } = new();
}

public class MobileJournalLineDto
{
    public Guid AccountId { get; set; }
    public string? LineDescription { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}
