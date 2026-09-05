using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AumoFinance.Controllers.Api.Reports;
using AumoFinance.Models;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Services
{
    // Satu-satunya sumber logika pembuatan ayat jurnal penutup (Closing
    // Journal) yang SUNGGUHAN disimpan ke ledger — dipakai oleh
    // PeriodsController (Api) dan PeriodsController (Web) saat periode
    // ditutup, supaya kedua sisi selalu konsisten.
    //
    // Beda dengan ClosingJournalControllers (Api/Reports) & ClosingJournalController
    // (Web/Reports): kedua controller itu HANYA laporan pratinjau (preview) yang
    // memakai akun perantara "Income Summary" fiktif dan TIDAK PERNAH disimpan.
    // Helper ini sebaliknya membuat JournalEntry sungguhan (JournalType =
    // "Closing") yang menutup langsung setiap akun sementara ke Retained
    // Earnings, tanpa akun perantara — supaya tidak butuh ChartOfAccount baru
    // yang tidak ada di skema.
    public static class ClosingJournalPoster
    {
        public const string JournalTypeClosing = "Closing";
        private const string ClosingDescription = "closing journal";

        // Menghasilkan JournalEntry (belum disimpan ke _db, belum SaveChanges)
        // yang menutup semua akun sementara (Type: OperatingIncome/
        // OperatingExpenses/OtherIncome/OtherExpenses) bersaldo != 0 pada
        // periode ini ke saldo 0, dengan selisihnya (laba/rugi bersih)
        // dipindahkan ke akun Retained Earnings. Tanggal entri = hari
        // terakhir periode (EndDate), sehingga otomatis berada paling bawah
        // pada General Journal/General Ledger periode tsb.
        //
        // Mengembalikan null bila tidak ada yang perlu ditutup (semua akun
        // sementara sudah bersaldo 0) atau bila akun Retained Earnings belum
        // terdaftar di Chart of Accounts.
        public static async Task<JournalEntry?> BuildClosingEntryAsync(
            AppDbContext db,
            Guid userId,
            Period period,
            ITransactionNumberService txNumberService)
        {
            var rows = await TrialBalanceControllers.BuildTrialBalanceRowsAsync(db, userId, period, includeAdjusting: true);

            var temporaryRows = rows
                .Where(r => AccountClassification.IsTemporary(r.Type) && r.NetBalance != 0)
                .ToList();

            if (!temporaryRows.Any())
            {
                return null;
            }

            var retainedEarningsAccount = await db.ChartOfAccounts
                .FirstOrDefaultAsync(a => a.UserId == userId && a.IsActive && a.Role == "RetainedEarnings");

            if (retainedEarningsAccount == null)
            {
                return null;
            }

            var netIncome = IncomeStatementControllers.BuildIncomeStatement(rows, period).NetIncome;

            var lines = new List<JournalEntryLine>();
            int order = 0;

            foreach (var row in temporaryRows)
            {
                // Menutup saldo akun sementara ke 0: posting di sisi
                // BERLAWANAN dari sisi normalnya sebesar NetBalance (atau sisi
                // yang sama bila NetBalance kebetulan berlawanan/negatif).
                decimal debit = row.NormalBalanceIsDebit ? Math.Max(-row.NetBalance, 0) : Math.Max(row.NetBalance, 0);
                decimal credit = row.NormalBalanceIsDebit ? Math.Max(row.NetBalance, 0) : Math.Max(-row.NetBalance, 0);

                lines.Add(new JournalEntryLine
                {
                    AccountId = row.AccountId,
                    LineDescription = ClosingDescription,
                    Debit = debit,
                    Credit = credit,
                    LineOrder = order++
                });
            }

            if (netIncome != 0)
            {
                lines.Add(new JournalEntryLine
                {
                    AccountId = retainedEarningsAccount.Id,
                    LineDescription = ClosingDescription,
                    // Laba bersih menambah Retained Earnings (Credit); rugi
                    // bersih menguranginya (Debit).
                    Debit = netIncome < 0 ? -netIncome : 0,
                    Credit = netIncome > 0 ? netIncome : 0,
                    LineOrder = order++
                });
            }

            var transactionNumber = await txNumberService.GenerateAsync(userId, JournalTypeClosing, period.EndDate);

            return new JournalEntry
            {
                UserId = userId,
                TransactionNumber = transactionNumber,
                JournalType = JournalTypeClosing,
                EntryDate = DateTime.SpecifyKind(period.EndDate.Date, DateTimeKind.Utc),
                CreatedAt = DateTime.UtcNow,
                Lines = lines
            };
        }
    }
}
