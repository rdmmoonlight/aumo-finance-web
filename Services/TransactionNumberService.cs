using System;
using System.Threading.Tasks;
using AumoFinance.Models;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Services
{
    // Satu-satunya sumber logika penomoran transaksi di seluruh aplikasi.
    // Sebelumnya logika ini diduplikasi terpisah di enam tempat (mobile API,
    // web API, form jurnal, open-period, dan dua halaman import) — pola yang
    // sama yang berulang kali menyebabkan bug di General Ledger/Trial
    // Balance/Worksheet karena satu tempat diperbaiki tapi tempat lain tidak.
    // Semua pembuatan JournalEntry wajib memanggil service ini.
    public class TransactionNumberService : ITransactionNumberService
    {
        private readonly AppDbContext _db;

        public TransactionNumberService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<string> GenerateAsync(Guid userId, string journalType, DateTime entryDate)
        {
            string prefix = journalType == "Adjusting" ? "AJ" : "GJ";
            string counterKey = $"{prefix}{entryDate:yyMM}";

            // UPSERT atomik: PostgreSQL menjamin INSERT ... ON CONFLICT DO
            // UPDATE ... RETURNING sebagai satu operasi tunggal di level
            // database. Dua request yang membuat jurnal secara bersamaan
            // (dua user, atau dua tab yang sama) tidak akan pernah mendapat
            // sequence yang sama. Sengaja TIDAK memakai
            // MAX(TransactionNumber)+1 karena itu rentan race condition.
            var nextSeq = await _db.Database.SqlQuery<int>($@"
                INSERT INTO ""TransactionCounters"" (""UserId"", ""CounterKey"", ""LastSequence"")
                VALUES ({userId}, {counterKey}, 1)
                ON CONFLICT (""UserId"", ""CounterKey"")
                DO UPDATE SET ""LastSequence"" = ""TransactionCounters"".""LastSequence"" + 1
                RETURNING ""LastSequence"" AS ""Value""
            ").SingleAsync();

            if (nextSeq > 9999)
            {
                // Kapasitas 4 digit (9999 transaksi per jenis dokumen per
                // bulan) habis. Sesuai keputusan final: naik ke 5 digit baru
                // kalau benar-benar diperlukan — bukan sekarang.
                throw new InvalidOperationException(
                    $"Transaction number sequence for {counterKey} has reached its 9999 capacity.");
            }

            return $"{counterKey}{nextSeq:D4}";
        }
    }
}
