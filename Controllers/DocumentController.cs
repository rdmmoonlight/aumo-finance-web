// GET: /Document/
public IActionResult Index(string searchString, string category)
{
    var query = _context.EconomicDocuments.AsQueryable();

    if (!string.IsNullOrEmpty(searchString))
    {
        query = query.Where(d => d.Title.Contains(searchString) || 
                               (d.ReferenceNumber != null && d.ReferenceNumber.Contains(searchString)));
    }

    if (!string.IsNullOrEmpty(category))
    {
        query = query.Where(d => d.Category == category);
    }

    var documentList = query.OrderByDescending(d => d.UploadDate).ToList();

    // --- Statistical Computations ---
    var allDocs = _context.EconomicDocuments.ToList();
    var totalBytes = allDocs.Sum(d => d.FileSize);
    
    var topCategory = allDocs.GroupBy(d => d.Category)
                             .OrderByDescending(g => g.Count())
                             .Select(g => g.Key)
                             .FirstOrDefault() ?? "-";

    // Menentukan tanggal deploy pertama aplikasi (bisa di-hardcode atau diambil dari file/database setting)
    // Contoh menetapkan tanggal peluncuran sistem: 1 Januari 2026
    var deploymentDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    var ageInDays = (int)(DateTime.UtcNow - deploymentDate).TotalDays;

    var viewModel = new DocumentIndexViewModel
    {
        Documents = documentList,
        TotalDocuments = allDocs.Count,
        TotalStorageMB = Math.Round((double)totalBytes / (1024 * 1024), 2),
        AddedLast7Days = allDocs.Count(d => d.UploadDate >= DateTime.UtcNow.AddDays(-7)),
        MostFrequentCategory = topCategory,
        AverageFileSizeKB = allDocs.Any() ? Math.Round((double)totalBytes / allDocs.Count / 1024, 2) : 0,

        // Metrik Sistem & Akuntansi
        AppDeploymentDate = deploymentDate,
        AppAgeDays = ageInDays > 0 ? ageInDays : 1,
        TotalJournalEntries = _context.JournalEntries.Count(),
        TotalChartOfAccounts = _context.ChartOfAccounts.Count(),
        TotalActivePeriods = _context.Periods.Count(p => p.IsActive),
        TotalSystemUsers = _context.Users.Count()
    };

    return View(viewModel);
}
