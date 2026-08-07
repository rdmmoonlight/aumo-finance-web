using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Maui.Controls;
using AumoFinance.Services.Reports;

namespace AumoFinance.Pages.Reports.GeneralJournal;

public partial class GeneralJournalPage : ContentPage
{
    private readonly GeneralJournalService _generalJournalService;
    private readonly CultureInfo _usdCulture = new("en-US");

    public GeneralJournalPage(GeneralJournalService generalJournalService)
    {
        InitializeComponent();
        _generalJournalService = generalJournalService;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await LoadGeneralJournalAsync();
    }

    private async Task LoadGeneralJournalAsync()
    {
        SetLoadingState(true);

        try
        {
            var (data, errorDetail) = await _generalJournalService.GetGeneralJournalReportAsync();

            if (!string.IsNullOrEmpty(errorDetail))
            {
                await this.DisplayAlertAsync("Error", errorDetail, "OK");
                return;
            }

            if (data != null)
            {
                SelectedPeriodHeaderLabel.Text = string.IsNullOrWhiteSpace(data.SelectedPeriodName)
                    ? "No Active Period"
                    : data.SelectedPeriodName;

                var viewModels = data.Entries.Select(e => new GeneralJournalEntryViewModel
                {
                    Id = e.Id,
                    EntryDate = e.EntryDate,
                    JournalType = e.JournalType ?? "General",
                    ReferenceNumber = e.ReferenceNumber ?? string.Empty,
                    Lines = e.Lines.Select(l => new GeneralJournalLineViewModel
                    {
                        AccountReferenceNumber = l.ReferenceNumber,
                        AccountName = l.AccountName ?? string.Empty,
                        LineDescription = l.LineDescription,
                        Debit = l.Debit,
                        Credit = l.Credit,
                        UsdCulture = _usdCulture
                    }).ToList(),
                    UsdCulture = _usdCulture
                }).ToList();

                JournalCollectionView.ItemsSource = viewModels;
                EmptyStateView.IsVisible = !viewModels.Any();
                JournalCollectionView.IsVisible = viewModels.Any();
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"LoadGeneralJournalAsync error: {ex}");
            await this.DisplayAlertAsync("Error", $"An unexpected error occurred: {ex.Message}", "OK");
        }
        finally
        {
            SetLoadingState(false);
            JournalRefreshView.IsRefreshing = false;
        }
    }

    public async void OnRefreshClicked(object? sender, EventArgs e)
    {
        await LoadGeneralJournalAsync();
    }

    public async void OnRefreshViewRefreshing(object? sender, EventArgs e)
    {
        await LoadGeneralJournalAsync();
    }

    private void SetLoadingState(bool isLoading)
    {
        LoadingIndicator.IsVisible = isLoading;
        LoadingIndicator.IsRunning = isLoading;
    }
}

// ==========================================
// VIEW MODELS UNTUK BINDING RENDER
// ==========================================
public class GeneralJournalEntryViewModel
{
    public int Id { get; set; }
    public DateTime EntryDate { get; set; }
    public string JournalType { get; set; } = "General";
    public string ReferenceNumber { get; set; } = string.Empty;
    public List<GeneralJournalLineViewModel> Lines { get; set; } = new();
    public CultureInfo UsdCulture { get; set; } = new("en-US");

    public string FormattedDate => EntryDate.ToString("MMM dd, yyyy");
}

public class GeneralJournalLineViewModel
{
    public int AccountReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string? LineDescription { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public CultureInfo UsdCulture { get; set; } = new("en-US");

    public string FormattedDebit => Debit > 0 ? Debit.ToString("C2", UsdCulture) : "-";
    public string FormattedCredit => Credit > 0 ? Credit.ToString("C2", UsdCulture) : "-";
}
