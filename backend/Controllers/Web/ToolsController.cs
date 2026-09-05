using System.IO;
using System.Security.Claims;
using AumoFinance.Models;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Controllers.Web;

[ApiController]
[Route("web/tools")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class ToolsWebController : ControllerBase
{
    private readonly AppDbContext _context;

    public ToolsWebController(AppDbContext context)
    {
        _context = context;
    }

    // ==========================================
    // 1. GET: /web/tools/download-journal-template
    // ==========================================
    [HttpGet("download-journal-template")]
    public IActionResult DownloadJournalTemplate()
    {
        using var workbook = new XLWorkbook();

        // --- Sheet General Journal (GJ) ---
        var wsGj = workbook.Worksheets.Add("GJ");
        wsGj.Cell(1, 1).Value = "Date";
        wsGj.Cell(1, 2).Value = "Account Name";
        wsGj.Cell(1, 3).Value = "Description";
        wsGj.Cell(1, 4).Value = "Ref";
        wsGj.Cell(1, 5).Value = "Debit";
        wsGj.Cell(1, 6).Value = "Credit";
        wsGj.Row(1).Style.Font.Bold = true;

        // --- Sheet Adjusting Journal (AJ) ---
        var wsAj = workbook.Worksheets.Add("AJ");
        wsAj.Cell(1, 1).Value = "Date";
        wsAj.Cell(1, 2).Value = "Account Name";
        wsAj.Cell(1, 3).Value = "Description";
        wsAj.Cell(1, 4).Value = "Ref";
        wsAj.Cell(1, 5).Value = "Debit";
        wsAj.Cell(1, 6).Value = "Credit";
        wsAj.Row(1).Style.Font.Bold = true;

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        var content = stream.ToArray();

        return File(
            content,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "JournalImportTemplate.xlsx"
        );
    }

    // ==========================================
    // 2. POST: /web/tools/import-journal-entries
    // ==========================================
    [HttpPost("import-journal-entries")]
    public async Task<IActionResult> ImportJournalEntries([FromBody] JournalImportRequestDto request)
    {
        if (request?.Transactions == null || !request.Transactions.Any())
        {
            return BadRequest(new { message = "Tidak ada data transaksi untuk diimpor." });
        }

        // Ambil UserId dari User Login
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        using var dbTransaction = await _context.Database.BeginTransactionAsync();

        try
        {
            int createdCoaCount = 0;

            foreach (var txDto in request.Transactions)
            {
                if (!DateTime.TryParse(txDto.Date, out var txDate))
                {
                    continue; // Skip jika format tanggal tidak valid
                }

                // -------------------------------------------------------------
                // A. AUTOMATION PERIODE: Cek / Buat Periode Baru Jika Belum Ada
                // -------------------------------------------------------------
                var period = await _context.Periods.FirstOrDefaultAsync(p => 
                    p.UserId == userId && 
                    p.Year == txDate.Year && 
                    p.Month == txDate.Month
                );

                if (period == null)
                {
                    period = new Period
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        Year = txDate.Year,
                        Month = txDate.Month,
                        IsClosed = false
                    };
                    _context.Periods.Add(period);
                    await _context.SaveChangesAsync(); // Simpan periode baru langsung
                }

                // -------------------------------------------------------------
                // B. TRANSAKSI COUNTER: Penomoran Otomatis (Contoh: GJ26090001)
                // -------------------------------------------------------------
                string prefix = txDto.JournalType.Equals("Adjusting", StringComparison.OrdinalIgnoreCase) ? "AJ" : "GJ";
                string counterKey = $"{prefix}{txDate:yyMM}";

                var counter = await _context.TransactionCounters.FirstOrDefaultAsync(c => 
                    c.UserId == userId && 
                    c.CounterKey == counterKey
                );

                if (counter == null)
                {
                    counter = new TransactionCounter
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        CounterKey = counterKey,
                        LastSequence = 1
                    };
                    _context.TransactionCounters.Add(counter);
                }
                else
                {
                    counter.LastSequence += 1;
                }

                string transactionNumber = $"{counterKey}{counter.LastSequence:D4}";

                // -------------------------------------------------------------
                // C. MEMBUAT RECORD JOURNAL ENTRY
                // -------------------------------------------------------------
                var journalEntry = new JournalEntry
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    TransactionNumber = transactionNumber,
                    Date = txDate,
                    JournalType = txDto.JournalType,
                    CreatedAt = DateTime.UtcNow,
                    Lines = new List<JournalEntryLine>()
                };

                // -------------------------------------------------------------
                // D. MEMPROSES BARIS INDIVIDUAL & AKUN COA
                // -------------------------------------------------------------
                foreach (var lineDto in txDto.Lines)
                {
                    // Cek COA berdasarkan Reference Number & UserId
                    var coa = await _context.ChartOfAccounts.FirstOrDefaultAsync(c => 
                        c.UserId == userId && 
                        c.ReferenceNumber == lineDto.RefNumber
                    );

                    // Buat COA Baru Otomatis jika belum ada di database
                    if (coa == null)
                    {
                        coa = new ChartOfAccount
                        {
                            Id = Guid.NewGuid(),
                            UserId = userId,
                            ReferenceNumber = lineDto.RefNumber,
                            Name = lineDto.AccountName,
                            IsActive = true
                        };
                        _context.ChartOfAccounts.Add(coa);
                        await _context.SaveChangesAsync();
                        createdCoaCount++;
                    }

                    journalEntry.Lines.Add(new JournalEntryLine
                    {
                        Id = Guid.NewGuid(),
                        JournalEntryId = journalEntry.Id,
                        AccountId = coa.Id,
                        Description = lineDto.Description,
                        Debit = lineDto.Debit,
                        Credit = lineDto.Credit
                    });
                }

                _context.JournalEntries.Add(journalEntry);
            }

            await _context.SaveChangesAsync();
            await dbTransaction.CommitAsync();

            return Ok(new
            {
                message = "Berhasil mengimpor data jurnal.",
                createdCoaCount = createdCoaCount
            });
        }
        catch (Exception ex)
        {
            await dbTransaction.RollbackAsync();
            return StatusCode(500, new { message = $"Gagal menyimpan data: {ex.Message}" });
        }
    }
}

// ==========================================
// DTO DUKUNGAN UNTUK REQUEST BODY
// ==========================================
public class JournalImportRequestDto
{
    public List<JournalTransactionDto> Transactions { get; set; } = new();
}

public class JournalTransactionDto
{
    public string Date { get; set; } = string.Empty;
    public string JournalType { get; set; } = string.Empty;
    public List<JournalLineDto> Lines { get; set; } = new();
}

public class JournalLineDto
{
    public int RefNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal? Debit { get; set; }
    public decimal? Credit { get; set; }
}
