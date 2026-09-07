using System;
using System.Threading.Tasks;

namespace AumoFinance.Services
{
    public interface ITransactionNumberService
    {
        // Menghasilkan TransactionNumber baru dengan format
        // [PREFIX][YY][MM][SEQUENCE 4 digit], contoh: GJ26080001.
        // Prefix: GJ untuk General, AJ untuk Adjusting.
        // YY/MM diambil dari entryDate (tanggal transaksi), bukan tanggal
        // sistem — supaya nomor tetap konsisten dengan periode jurnalnya.
        // Sequence reset ke 0001 setiap bulan, per user, per jenis jurnal.
        Task<string> GenerateAsync(Guid userId, string journalType, DateTime entryDate);

        // Menampilkan perkiraan nomor transaksi berikutnya TANPA
        // menaikkan/mengonsumsi sequence — dipakai murni untuk preview di
        // form (mis. saat halaman dibuka atau jenis jurnal diganti).
        // Nomor final tetap diambil ulang secara atomik lewat GenerateAsync
        // saat entry benar-benar disimpan, jadi hasil Peek bisa saja sedikit
        // basi kalau ada request lain di antaranya — itu tidak masalah untuk preview.
        Task<string> PeekNextAsync(Guid userId, string journalType, DateTime entryDate);
    }
}
