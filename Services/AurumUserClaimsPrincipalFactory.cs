using System.Security.Claims;
using AumoFinance.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace AumoFinance.Services
{
    /// <summary>
    /// Adds the user's FullName as the principal's ClaimTypes.Name (falling
    /// back to the username/email when none is set), so views like
    /// _Sidebar.cshtml keep showing the person's name exactly as they did
    /// under the old API-backed claims mapping in AuthPrincipalFactory.
    /// </summary>
    public class AumoUserClaimsPrincipalFactory : UserClaimsPrincipalFactory<ApplicationUser, IdentityRole<Guid>>
    {
        public AumoUserClaimsPrincipalFactory(
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole<Guid>> roleManager,
            IOptions<IdentityOptions> options)
            : base(userManager, roleManager, options)
        {
        }

        protected override async Task<ClaimsIdentity> GenerateClaimsAsync(ApplicationUser user)
        {
            var identity = await base.GenerateClaimsAsync(user);

            if (!string.IsNullOrWhiteSpace(user.FullName))
            {
                var existingName = identity.FindFirst(ClaimTypes.Name);
                if (existingName is not null)
                {
                    identity.RemoveClaim(existingName);
                }

                identity.AddClaim(new Claim(ClaimTypes.Name, user.FullName));
            }

            return identity;
        }
    }
}
