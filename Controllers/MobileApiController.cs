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

    // Inject AppDbContext ke Controller
    public MobileApiController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        try
        {
            // Ambil data real dari tabel database Anda
            // (Sesuaikan nama DbSet / Properti di DbContext Anda jika berbeda)
            
            // 1. Contoh hitung Total Kas (Misal dari perkiraan Kas/Bank)
            var totalCash = await _context.Accounts
                .Where(a => a.AccountType == "Cash" || a.AccountType == "Bank")
                .SumAsync(a => a.Balance);

            // 2. Hitung Total Revenue (Pendapatan)
            var revenue = await _context.Accounts
                .Where(a => a.AccountType == "Revenue")
                .SumAsync(a => a.Balance);

            // 3. Hitung Total Expenses (Beban/Biaya)
            var expenses = await _context.Accounts
                .Where(a => a.AccountType == "Expense")
                .SumAsync(a => a.Balance);

            // 4. Hitung Laba Bersih
            var netIncome = revenue - expenses;

            var activePeriod = DateTime.Now.ToString("yyyy-MM"); // Periode Bulan Ini

            return Ok(new
            {
                totalCash = totalCash,
                revenue = revenue,
                expenses = expenses,
                netIncome = netIncome,
                activePeriod = activePeriod
            });
        }
        catch (Exception ex)
        {
            // Jika ada tabel yang belum di-query dengan pas, fallback nilai aman
            return StatusCode(500, new { message = "Error reading database", error = ex.Message });
        }
    }
}
