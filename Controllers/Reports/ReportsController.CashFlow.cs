using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AumoFinance.Models;

namespace AumoFinance.Controllers
{
    public partial class ReportsController
    {
        // ==========================================================
        // CASH FLOW STATEMENT (Direct Method - IAS 7)
        // ==========================================================

        public async Task<IActionResult> CashFlowStatement()
        {
            ViewData["Title"] = "Cash Flow Statement";
            var (userId, period) = await GetReportContextAsync();
            if (period == null)
            {
                ViewBag.NoPeriodSelected = true;
                return View(new CashFlowStatementViewModel());
            }
            ViewBag.SelectedPeriod = period;

            // Ambil semua akun yang berperan sebagai Kas dan Setara Kas
            var cashAccounts = await _db.ChartOfAccounts
                .Where(a => a.IsActive && a.UserId == userId && a.Role == "CashAndEquivalents")
                .ToListAsync();

            var cashAccountIds = cashAccounts.Select(a => a.Id).ToList();

            var vm = new CashFlowStatementViewModel();

            if (!cashAccountIds.Any())
            {
                return View(vm);
            }

            // 1. HITUNG SALDO AWAL KAS (Akumulasi mutasi kas sebelum Tanggal Mulai Periode)
            var priorLines = await _db.JournalEntryLines
                .Include(l => l.JournalEntry)
                .Where(l => cashAccountIds.Contains(l.AccountId)
                         && l.JournalEntry!.UserId == userId
                         && l.JournalEntry!.EntryDate < period.StartDate)
                .ToListAsync();

            vm.BeginningCash = priorLines.Sum(l => l.Debit - l.Credit);

            // 2. AMBIL SEMUA JURNAL DI PERIODE BERJALAN YANG MELIBATKAN AKUN KAS
            var validEntryIds = await _db.JournalEntryLines
                .Include(l => l.JournalEntry)
                .Where(l => cashAccountIds.Contains(l.AccountId)
                         && l.JournalEntry!.UserId == userId
                         && l.JournalEntry!.EntryDate >= period.StartDate
                         && l.JournalEntry!.EntryDate <= period.EndDate)
                .Select(l => l.JournalEntryId)
                .Distinct()
                .ToListAsync();

            var entries = await _db.JournalEntries
                .Include(j => j.Lines)
                    .ThenInclude(l => l.Account)
                .Where(j => validEntryIds.Contains(j.Id))
                .ToListAsync();

            var operating = new Dictionary<string, decimal>();
            var investing = new Dictionary<string, decimal>();
            var financing = new Dictionary<string, decimal>();

            void AddAmount(Dictionary<string, decimal> bucket, string key, decimal val)
            {
                if (val == 0) return;
                bucket[key] = bucket.GetValueOrDefault(key) + val;
            }

            foreach (var entry in entries)
            {
                // Hitung total bersih kas pada transaksi ini (Debit menambah kas, Kredit mengurangi kas)
                var cashDelta = entry.Lines
                    .Where(l => cashAccountIds.Contains(l.AccountId))
                    .Sum(l => l.Debit - l.Credit);

                if (cashDelta == 0) continue;

                // Ambil akun lawan (contra accounts) selain kas di transaksi ini
                var contraLines = entry.Lines
                    .Where(l => !cashAccountIds.Contains(l.AccountId))
                    .ToList();

                if (!contraLines.Any()) continue;

                // Total absolut nilai akun lawan untuk proporsi jika ada multi-akun
                var totalContraAmount = contraLines.Sum(l => l.Debit + l.Credit);
                if (totalContraAmount == 0) continue;

                foreach (var line in contraLines)
                {
                    // Nilai mutasi akun lawan dalam jurnal ini
                    var lineMagnitude = line.Debit + line.Credit;
                    if (lineMagnitude == 0) continue;

                    // Alokasi proporsi kas jika jurnal majemuk
                    var proportion = lineMagnitude / totalContraAmount;
                    var allocatedCash = cashDelta * proportion;

                    var type = line.Account?.Type ?? "";
                    var role = line.Account?.Role ?? "";
                    var name = line.Account?.AccountName ?? "Other Transactions";

                    // Klasifikasi Arus Kas Berdasarkan Standar Akuntansi (IAS 7)
                    // Operating: Pendapatan, Beban, Aset Lancar / Utang Lancar
                    if (type == "OperatingIncome" || type == "OperatingExpenses" ||
                        type == "OtherIncome" || type == "OtherExpenses" ||
                        role == "CurrentAsset" || role == "CurrentLiability" ||
                        role == "AccountsReceivable" || role == "AccountsPayable")
                    {
                        AddAmount(operating, name, allocatedCash);
                    }
                    // Investing: Pembelian/Penjualan Aset Tetap / Investasi Jangka Panjang
                    else if (type == "Assets" || role == "NonCurrentAsset" || role == "FixedAsset" || role == "Investment")
                    {
                        AddAmount(investing, name, allocatedCash);
                    }
                    // Financing: Ekuitas, Prive/Modal Pemilik, Utang Bank Jangka Panjang
                    else if (type == "Equity" || type == "Liabilities" || role == "NonCurrentLiability" || role == "LongTermDebt")
                    {
                        AddAmount(financing, name, allocatedCash);
                    }
                    else
                    {
                        // Default fallback ke Operating jika tipe akun tidak dikenali
                        AddAmount(operating, name, allocatedCash);
                    }
                }
            }

            vm.OperatingActivities = operating.Select(kv => new CashFlowLine { Description = kv.Key, Amount = kv.Value }).OrderByDescending(l => l.Amount).ToList();
            vm.InvestingActivities = investing.Select(kv => new CashFlowLine { Description = kv.Key, Amount = kv.Value }).OrderByDescending(l => l.Amount).ToList();
            vm.FinancingActivities = financing.Select(kv => new CashFlowLine { Description = kv.Key, Amount = kv.Value }).OrderByDescending(l => l.Amount).ToList();

            return View(vm);
        }
    }
}
