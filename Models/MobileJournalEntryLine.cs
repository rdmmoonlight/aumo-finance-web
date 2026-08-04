using Microsoft.Maui.ApplicationModel;
using Microsoft.Maui.Controls;
using Microsoft.Maui.Graphics;

namespace AumoFinance.Views;

public partial class TopBarView : ContentView
{
    public TopBarView()
    {
        InitializeComponent();
    }

    #region Bindable Properties

    public static readonly BindableProperty PeriodTextProperty =
        BindableProperty.Create(
            nameof(PeriodText),
            typeof(string),
            typeof(TopBarView),
            default(string),
            propertyChanged: OnPeriodTextChanged);

    public string PeriodText
    {
        get => (string)GetValue(PeriodTextProperty);
        set => SetValue(PeriodTextProperty, value);
    }

    private static void OnPeriodTextChanged(BindableObject bindable, object oldValue, object newValue)
    {
        if (bindable is TopBarView control && control.PeriodLabel != null)
        {
            control.PeriodLabel.Text = newValue as string;
        }
    }

    #endregion

    /// <summary>
    /// Mengubah indikator badge sync (Hijau untuk terhubung/sukses, Merah untuk gagal/terputus)
    /// </summary>
    /// <param name="isSuccess">Status koneksi/sinkronisasi</param>
    public void SetSyncStatus(bool isSuccess)
    {
        MainThread.BeginInvokeOnMainThread(() =>
        {
            if (SyncBadge == null) return;

            var statusColor = isSuccess 
                ? Color.FromArgb("#10B981")  // Emerald Green
                : Color.FromArgb("#EF4444"); // Red

            SyncBadge.BackgroundColor = statusColor;
            SyncBadge.Stroke = statusColor;
        });
    }
}
