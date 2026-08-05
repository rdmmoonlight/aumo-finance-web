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
            // 1. Prioritas utama: periode yang sedang di-view manual (IsSelected)
            var selected = await db.Periods
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.UserId == userId && p.IsSelected);
                
            if (selected != null)
            {
                return selected;
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
            var currentlySelected = await db.Periods
                .Where(p => p.UserId == userId && p.IsSelected)
                .ToListAsync();

            foreach (var p in currentlySelected)
            {
                p.IsSelected = false;
            }

            var target = await db.Periods
                .FirstOrDefaultAsync(p => p.Id == periodId && p.UserId == userId);

            if (target != null)
            {
                target.IsSelected = true;
            }

            await db.SaveChangesAsync();
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
