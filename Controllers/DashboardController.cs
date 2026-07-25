using Microsoft.AspNetCore.Mvc;
using AumoFinance.Models; // Sesuaikan dengan namespace ViewModel-mu
using System;
using System.Collections.Generic;

namespace AumoFinance.Controllers
{
    public class DashboardController : Controller
    {
        // Inject Database Context kamu di sini (misal: ApplicationDbContext)
        // public DashboardController(ApplicationDbContext context) { ... }

        public IActionResult Index()
        {
            // CONTOH: Ambil data dari database. 
            // Nanti ganti pakai query LINQ beneran ke tabel Jurnal/Buku Besar.
            var model = new DashboardViewModel
            {
                TotalKasBank = 142500000,
                PendapatanBulanIni = 58400000,
                BebanOperasional = 21150000,
                LabaBersih = 37250000,
                
                // Data untuk chart
                ChartLabels = new List<string> { "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul" },
                ChartPendapatan = new List<decimal> { 45000000, 52000000, 48000000, 61000000, 55000000, 67000000, 58400000 },
                ChartBeban = new List<decimal> { 20000000, 22000000, 19000000, 25000000, 23000000, 28000000, 21150000 },

                // Data untuk tabel
                RecentJournals = new List<JournalEntryDto>
                {
                    new JournalEntryDto { ReferenceNo = "JV-2026/07/004", Date = new DateTime(2026, 7, 24), Memo = "Penerimaan Piutang", TotalDebit = 12500000, TotalCredit = 12500000 },
                    new JournalEntryDto { ReferenceNo = "JV-2026/07/003", Date = new DateTime(2026, 7, 22), Memo = "Bayar Listrik", TotalDebit = 3200000, TotalCredit = 3200000 }
                },

                // Data COA
                MainCoaBalances = new List<CoaBalanceDto>
                {
                    new CoaBalanceDto { AccountCode = "1010", AccountName = "Kas Utama", Category = "Aktiva", Balance = 42500000 },
                    new CoaBalanceDto { AccountCode = "1030", AccountName = "Piutang Usaha", Category = "Aktiva", Balance = 18200000 }
                }
            };

            return View(model);
        }
    }
}