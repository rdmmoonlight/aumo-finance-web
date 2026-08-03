using System.Security.Claims;

namespace AumoFinance.Controllers
{
    // Helper kecil untuk mengambil Id user yang sedang login (Guid), dipakai
    // di seluruh controller untuk menyekat data per-user (Chart of Accounts,
    // Periods, Journal Entries).
    public static class ControllerExtensions
    {
        public static Guid CurrentUserId(this Microsoft.AspNetCore.Mvc.Controller controller)
        {
            var idStr = controller.User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(idStr, out var id) ? id : Guid.Empty;
        }
    }
}
