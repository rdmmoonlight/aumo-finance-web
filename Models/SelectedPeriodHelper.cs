using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Models
{
    // Periode yang sedang "di-view" (dipilih lewat ikon mata di halaman
    // Periods) disimpan permanen di kolom Periods.IsSelected, DIBATASI per
    // user (setiap user hanya melihat/menyeleksi periodenya sendiri, karena
    // Chart of Accounts, Periods, dan Journal Entries kini terisolasi
    // sepenuhnya per user).
    public static class SelectedPeriodHelper
    {
        public static async Task<Period?> GetSelectedPeriodAsync(AppDbContext db, Guid userId)
        {
            return await db.Periods.FirstOrDefaultAsync(p => p.UserId == userId && p.IsSelected);
        }

        public static async Task SelectPeriodAsync(AppDbContext db, Guid userId, int periodId)
        {
            var currentlySelected = await db.Periods.Where(p => p.UserId == userId && p.IsSelected).ToListAsync();
            foreach (var p in currentlySelected)
            {
                p.IsSelected = false;
            }
            await db.SaveChangesAsync();

            var target = await db.Periods.FirstOrDefaultAsync(p => p.Id == periodId && p.UserId == userId);
            if (target != null)
            {
                target.IsSelected = true;
                await db.SaveChangesAsync();
            }
        }

        public static async Task ClearSelectionAsync(AppDbContext db, Guid userId)
        {
            var currentlySelected = await db.Periods.Where(p => p.UserId == userId && p.IsSelected).ToListAsync();
            foreach (var p in currentlySelected)
            {
                p.IsSelected = false;
            }
            await db.SaveChangesAsync();
        }
    }
}
