using System;
using System.Collections.Generic;
using AumoFinance.Models;

namespace AumoFinance.ViewModels;

public class DocumentIndexViewModel
{
    public IEnumerable<EconomicDocument> Documents { get; set; } = new List<EconomicDocument>();

    // --- Document Statistics ---
    public int TotalDocuments { get; set; }
    public double TotalStorageMB { get; set; }
    public int AddedLast7Days { get; set; }
    public string MostFrequentCategory { get; set; } = "-";

    // --- System & Accounting Statistics ---
    public DateTime AppDeploymentDate { get; set; }
    public int AppAgeDays { get; set; }
    public int TotalJournalEntries { get; set; }
    public int TotalChartOfAccounts { get; set; }
    public int TotalActivePeriods { get; set; }
    public int TotalSystemUsers { get; set; }
    public double AverageFileSizeKB { get; set; }
}
