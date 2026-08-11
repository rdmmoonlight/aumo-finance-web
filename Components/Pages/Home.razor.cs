using Microsoft.AspNetCore.Components;

namespace AumoFinance.Pages;

public partial class Home : ComponentBase
{
    /// <summary>
    /// Deskripsi sistem finansial yang ditampilkan dengan gaya elegan dan presisi.
    /// </summary>

    protected string DescriptionText { get; set; } =
        "Integrated financial & accounting intelligence core. Manage full-cycle general ledgers, trial balances, and operational analytics with absolute precision.";

    protected override void OnInitialized()
    {
        // Tempat untuk inisialisasi logika atau data tambahan di masa mendatang
        base.OnInitialized();
    }
}
