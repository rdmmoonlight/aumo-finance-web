using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;

namespace AumoFinance.Controllers;

public partial class AuthController
{
    [HttpGet]
    public async Task<IActionResult> VerifyEmail(string email, string token)
    {
        // Kode VerifyEmail yang sama seperti di atas...
    }
}
