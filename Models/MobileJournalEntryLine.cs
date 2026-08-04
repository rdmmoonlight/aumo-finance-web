namespace AumoFinance.Views;

public partial class TopBarView : ContentView
{
    public TopBarView()
    {
        InitializeComponent();
    }

    public string PeriodText
    {
        get => PeriodLabel.Text;
        set => PeriodLabel.Text = value;
    }

    // Mengubah indikator badge (misal: hijau untuk terhubung)
    public void SetSyncStatus(bool isSuccess)
    {
        MainThread.BeginInvokeOnMainThread(() =>
        {
            SyncBadge.BackgroundColor = isSuccess ? Color.FromArgb("#10B981") : Color.FromArgb("#EF4444");
            SyncBadge.Stroke = isSuccess ? Color.FromArgb("#10B981") : Color.FromArgb("#EF4444");
        });
    }
}
