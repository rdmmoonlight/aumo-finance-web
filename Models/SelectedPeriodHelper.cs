using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Models
{
    public static class SelectedPeriodHelper
    {
        public static async Task<Period?> GetSelectedPeriodAsync(AppDbContext db, Guid userId)
        {
            // 1. Prioritas utama: periode yang sedang di-view manual (IsSelected).
            //    Ambil SEMUA baris yang bertanda selected (bukan cuma satu) supaya
            //    kita bisa mendeteksi & memperbaiki sendiri kalau ada lebih dari
            //    satu baris IsSelected=true untuk user yang sama — kondisi yang
            //    seharusnya dicegah oleh unique index IX_Periods_IsSelected_Unique,
            //    tapi index itu migration manual (lihat
            //    manual-neon-run-selected-period.sql) sehingga tidak dijamin
            //    benar-benar sudah dijalankan di database.
            var selectedRows = await db.Periods
                .Where(p => p.UserId == userId && p.IsSelected)
                .OrderByDescending(p => p.StartDate)
                .ToListAsync();

            if (selectedRows.Count > 0)
            {
                var mostRecent = selectedRows[0];

                if (selectedRows.Count > 1)
                {
                    // Data tidak konsisten (lebih dari satu baris selected) —
                    // perbaiki sendiri: simpan hanya yang StartDate paling baru,
                    // lepas tanda selected dari sisanya.
                    foreach (var stale in selectedRows.Skip(1))
                    {
                        stale.IsSelected = false;
                    }
                    await db.SaveChangesAsync();
                }

                return mostRecent;
            }

            // 2. Fallback: periode aktif berjalan
            // Pastikan perbandingan tanggal dilakukan dalam UTC yang bersih tanpa membuang Kind UTC
            var nowUtc = DateTime.UtcNow;

            return await db.Periods
                .AsNoTracking()
                .Where(p => p.UserId == userId
                         && !p.IsClosed
                         && p.StartDate <= nowUtc
                         && p.EndDate >= nowUtc)
                .OrderByDescending(p => p.StartDate)
                .FirstOrDefaultAsync();
        }

        public static async Task SelectPeriodAsync(AppDbContext db, Guid userId, int periodId)
        {
            // PENTING: harus DUA langkah SaveChangesAsync terpisah, bukan
            // digabung jadi satu batch. Kolom IsSelected dijaga oleh unique
            // partial index di database (maksimum satu TRUE per user, index
            // tidak deferrable) — kalau "set target=true" dan "clear yang
            // lama=false" dikirim dalam satu batch yang sama, EF Core tidak
            // menjamin urutan statement UPDATE-nya. Kalau UPDATE ...=true
            // sempat dieksekusi Postgres SEBELUM UPDATE ...=false untuk baris
            // lama committed, unique index langsung menolak (violation) dan
            // SELURUH SaveChangesAsync di-rollback — sehingga pemilihan
            // periode baru gagal total dan diam-diam kembali ke periode lama.

            // Langkah 1: lepas tanda selected dari SEMUA periode lain milik
            // user ini dulu, dan commit sendiri.
            var currentlySelected = await db.Periods
                .Where(p => p.UserId == userId && p.IsSelected && p.Id != periodId)
                .ToListAsync();

            if (currentlySelected.Count > 0)
            {
                foreach (var p in currentlySelected)
                {
                    p.IsSelected = false;
                }
                await db.SaveChangesAsync();
            }

            // Langkah 2: baru tandai periode target sebagai selected.
            var target = await db.Periods
                .FirstOrDefaultAsync(p => p.Id == periodId && p.UserId == userId);

            if (target != null && !target.IsSelected)
            {
                target.IsSelected = true;
                await db.SaveChangesAsync();
            }
        }

        public static async Task ClearSelectionAsync(AppDbContext db, Guid userId)
        {
            var currentlySelected = await db.Periods
                .Where(p => p.UserId == userId && p.IsSelected)
                .ToListAsync();

            foreach (var p in currentlySelected)
            {
                p.IsSelected = false;
            }

            await db.SaveChangesAsync();
        }
    }
}
