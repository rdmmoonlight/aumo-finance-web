using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models; // <-- Namespace folder Models

namespace AumoFinance.Controllers;

[ApiController]
[Route("api/mobile")]
public class MobileApiController : ControllerBase
{
    private readonly AppDbContext _db; // <-- Menggunakan AppDbContext (bukan ApplicationDbContext)

    public MobileApiController(AppDbContext db)
    {
        _db = db;
    }

    // GET: api/mobile/dashboard
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        // Contoh query sederhana ke DbContext Anda
        var totalCash = await _db.Accounts
            .Where(a => a.IsCash)
            .SumAsync(a => a.Balance);

        return Ok(new 
        { 
            TotalCash = totalCash,
            ActivePeriod = "2026-Q3",
            Revenue = 0,
            Expenses = 0,
            NetIncome = 0
        });
    }
}
