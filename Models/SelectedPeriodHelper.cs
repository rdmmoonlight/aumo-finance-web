using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Models
{
    // Menyimpan "periode yang sedang di-view" (dipilih lewat ikon mata di
    // halaman Periods) ke Session. Selama tidak ada periode yang dipilih,
    // seluruh halaman yang bergantung pada ini (General Journal, Adjusting
    // Journal, Dashboard, dst.) dianggap tidak punya data untuk ditampilkan.
    public static class SelectedPeriodHelper
    {
        private const string SessionKey = "SelectedPeriodId";

        public static void SetSelectedPeriod(HttpContext context, int periodId)
        {
            context.Session.SetInt32(SessionKey, periodId);
        }

        public static void ClearSelectedPeriod(HttpContext context)
        {
            context.Session.Remove(SessionKey);
        }

        public static int? GetSelectedPeriodId(HttpContext context)
        {
            return context.Session.GetInt32(SessionKey);
        }

        public static async Task<Period?> GetSelectedPeriodAsync(HttpContext context, AppDbContext db)
        {
            var id = GetSelectedPeriodId(context);
            if (id == null) return null;
            return await db.Periods.FindAsync(id.Value);
        }
    }
}
