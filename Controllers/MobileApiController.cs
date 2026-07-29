using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers.Api;

[ApiController]
[Route("api/mobile")]
public class MobileApiController : ControllerBase
{
    private readonly ApplicationDbContext _db; // DbContext Web Anda

    public MobileApiController(ApplicationDbContext db)
    {
        _db = db;
    }

    // GET: api/mobile/dashboard
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        // Contoh query langsung dari DB web yang sama
        var totalCash = await _db.Accounts
            .Where(a => a.IsCash)
            .SumAsync(a => a.Balance);

        return Ok(new 
        { 
            TotalCash = totalCash,
            ActivePeriod = "2026-Q3"
        });
    }

    // POST: api/mobile/journal
    [HttpPost("journal")]
    public async Task<IActionResult> CreateJournal([FromBody] MobileJournalDto dto)
    {
        if (!ModelState.IsValid) return BadRequest();

        // Simpan data transaksi langsung ke DB Web
        // ...
        await _db.SaveChangesAsync();

        return Ok(new { Message = "Berhasil disimpan" });
    }
}

public record MobileJournalDto(DateTime Date, decimal Amount, string Description);
