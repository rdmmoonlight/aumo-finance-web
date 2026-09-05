using System;
using System.Data;
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
            string prefix = journalType switch
            {
                "Adjusting" => "AJ",
                "Closing" => "CJ",
                _ => "GJ"
            };
            string counterKey = $"{prefix}{entryDate:yyMM}";

            // UPSERT atomik: PostgreSQL menjamin INSERT ... ON CONFLICT DO
            // UPDATE ... RETURNING sebagai satu operasi tunggal di level
            // database. Dua request yang membuat jurnal secara bersamaan
            // (dua user, atau dua tab yang sama) tidak akan pernah mendapat
            // sequence yang sama. Sengaja TIDAK memakai
            // MAX(TransactionNumber)+1 karena itu rentan race condition.
            //
            // Dieksekusi lewat ADO.NET langsung (bukan Database.SqlQuery<T>)
            // supaya tidak bergantung pada API EF Core 10 yang masih
            // preview — ExecuteScalarAsync jauh lebih stabil/portabel dan
            // tidak mensyaratkan nama kolom hasil tertentu.
            var connection = _db.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open)
            {
                await connection.OpenAsync();
            }

            using var command = connection.CreateCommand();
            command.CommandText = @"
                INSERT INTO ""TransactionCounters"" (""UserId"", ""CounterKey"", ""LastSequence"")
                VALUES (@userId, @counterKey, 1)
                ON CONFLICT (""UserId"", ""CounterKey"")
                DO UPDATE SET ""LastSequence"" = ""TransactionCounters"".""LastSequence"" + 1
                RETURNING ""LastSequence"";";

            var userIdParam = command.CreateParameter();
            userIdParam.ParameterName = "userId";
            userIdParam.Value = userId;
            command.Parameters.Add(userIdParam);

            var counterKeyParam = command.CreateParameter();
            counterKeyParam.ParameterName = "counterKey";
            counterKeyParam.Value = counterKey;
            command.Parameters.Add(counterKeyParam);

            var rawResult = await command.ExecuteScalarAsync()
                ?? throw new InvalidOperationException($"Transaction counter upsert for {counterKey} returned no result.");
            int nextSeq = Convert.ToInt32(rawResult);

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

        public async Task<string> PeekNextAsync(Guid userId, string journalType, DateTime entryDate)
        {
            string prefix = journalType switch
            {
                "Adjusting" => "AJ",
                "Closing" => "CJ",
                _ => "GJ"
            };
            string counterKey = $"{prefix}{entryDate:yyMM}";

            // Hanya membaca, tidak menaikkan LastSequence — kalau counter
            // belum ada, perkiraan berikutnya adalah 0001.
            var current = await _db.TransactionCounters
                .Where(c => c.UserId == userId && c.CounterKey == counterKey)
                .Select(c => (int?)c.LastSequence)
                .FirstOrDefaultAsync();

            var previewSeq = (current ?? 0) + 1;
            return $"{counterKey}{previewSeq:D4}";
        }
    }
}
