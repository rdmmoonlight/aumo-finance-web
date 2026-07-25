using Microsoft.AspNetCore.Identity;

namespace AumoFinance.Models
{
    /// <summary>
    /// The application's user record, owned entirely by ASP.NET Core Identity.
    /// Replaces the old hand-rolled User entity, which only ever shadowed
    /// accounts that actually lived in a separate external Aumo.Api service.
    /// </summary>
    public class ApplicationUser : IdentityUser<Guid>
    {
        public string? FullName { get; set; }
    }
}
