using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace AumoFinance.Controllers.Api; // Sesuaikan dengan namespace backend Anda

[ApiController]
[Route("api/[controller]")] // Menghasilkan URL: GET /api/dashboard
public class DashboardController : ControllerBase
{
    private readonly ApplicationDbContext _context; // Sesuaikan nama DbContext Anda

    public DashboardController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetDashboard()
    {
        try
        {
            // 1. Ambil Periode Akuntansi yang Aktif
            // Asumsi tabel 'Periods' memfilter periode aktif (atau ambil periode paling baru)
            var activePeriodObj = await _context.Periods
                .OrderByDescending(p => p.StartDate) // Sesuaikan nama kolom tanggal jika berbeda
                .FirstOrDefaultAsync(p => p.IsActive); // Sesuaikan dengan properti status aktif di tabel Periods

            string activePeriodText = activePeriodObj?.Name ?? "Agustus 2026";
            bool isClosed = activePeriodObj?.IsClosed ?? false;

            // Jika periode ditutup, tidak perlu kalkulasi jurnal
            if (isClosed)
            {
                return Ok(new
                {
                    activePeriod = activePeriodText,
                    isClosed = true,
                    totalCash = 0m,
                    netIncome = 0m,
                    revenue = 0m,
                    expenses = 0m
                });
            }

            // 2. Kalkulasi Data Keuangan berdasarkan ChartOfAccounts & JournalEntryLines
            // Mengambil semua jurnal line yang terkait dengan periode berjalan/aktif
            var journalLinesQuery = _context.JournalEntryLines
                .Include(j => j.Account)
                .AsQueryable();

            if (activePeriodObj != null)
            {
                // Filter jurnal berdasarkan rentang tanggal periode aktif
                journalLinesQuery = journalLinesQuery.Where(j =>
                    j.JournalEntry.EntryDate >= activePeriodObj.StartDate &&
                    j.JournalEntry.EntryDate <= activePeriodObj.EndDate);
            }

            var lines = await journalLinesQuery.ToListAsync();

            // Total Kas: Akun dengan tipe Kas/Bank (misal AccountType == "Asset" / "Cash")
            // Saldo Kas Normal = Debit - Kredit
            decimal totalCash = lines
                .Where(l => l.Account.AccountType == "Asset" || l.Account.IsCashAccount)
                .Sum(l => l.Debit - l.Credit);

            // Revenue (Pendapatan): Akun Tipe Revenue/Income
            // Saldo Pendapatan Normal = Kredit - Debit
            decimal revenue = lines
                .Where(l => l.Account.AccountType == "Revenue")
                .Sum(l => l.Credit - l.Debit);

            // Expenses (Beban): Akun Tipe Expense
            // Saldo Beban Normal = Debit - Kredit
            decimal expenses = lines
                .Where(l => l.Account.AccountType == "Expense")
                .Sum(l => l.Debit - l.Credit);

            // Net Income = Pendapatan - Beban
            decimal netIncome = revenue - expenses;

            // 3. Return JSON sesuai ekspektasi C# MAUI Client
            return Ok(new
            {
                activePeriod = activePeriodText,
                isClosed = false,
                totalCash = totalCash,
                netIncome = netIncome,
                revenue = revenue,
                expenses = expenses
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Gagal memproses data dashboard.",
                detail = ex.Message
            });
        }
    }
}
