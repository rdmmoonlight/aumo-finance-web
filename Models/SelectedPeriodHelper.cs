using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Models
{
    // Periode yang sedang "di-view" (dipilih lewat ikon mata di halaman
    // Periods) disimpan permanen di kolom Periods.IsSelected — bukan di
    // session — supaya statusnya benar-benar global: siapa pun yang
    // membuka aplikasi melihat periode yang sama, sampai ada yang
    // menggantinya. Seluruh aplikasi (Dashboard, General/Adjusting
    // Journal, laporan) bergantung pada periode ini.
    public static class SelectedPeriodHelper
    {
        public static async Task<Period?> GetSelectedPeriodAsync(AppDbContext db)
        {
            return await db.Periods.FirstOrDefaultAsync(p => p.IsSelected);
        }

        public static async Task SelectPeriodAsync(AppDbContext db, int periodId)
        {
            var currentlySelected = await db.Periods.Where(p => p.IsSelected).ToListAsync();
            foreach (var p in currentlySelected)
            {
                p.IsSelected = false;
            }
            await db.SaveChangesAsync();

            var target = await db.Periods.FindAsync(periodId);
            if (target != null)
            {
                target.IsSelected = true;
                await db.SaveChangesAsync();
            }
        }

        public static async Task ClearSelectionAsync(AppDbContext db)
        {
            var currentlySelected = await db.Periods.Where(p => p.IsSelected).ToListAsync();
            foreach (var p in currentlySelected)
            {
                p.IsSelected = false;
            }
            await db.SaveChangesAsync();
        }
    }
}
