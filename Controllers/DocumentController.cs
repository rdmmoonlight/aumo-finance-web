using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using System.IO;
using System;
using System.Linq;
using System.Threading.Tasks;
using AumoFinance.Models;
using AumoFinance.ViewModels;

namespace AumoFinance.Controllers;

public class DocumentController : Controller
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;

    public DocumentController(AppDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

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

        // Deployment date baseline (1 Januari 2026)
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

            // System & Accounting Metrics
            AppDeploymentDate = deploymentDate,
            AppAgeDays = ageInDays > 0 ? ageInDays : 1,
            TotalJournalEntries = _context.JournalEntries.Count(),
            TotalChartOfAccounts = _context.ChartOfAccounts.Count(),
            TotalActivePeriods = _context.Periods.Count(), // Disesuaikan dengan struktur tabel Period
            TotalSystemUsers = _context.Users.Count()
        };

        return View(viewModel);
    }

    // GET: /Document/Create
    public IActionResult Create()
    {
        return View();
    }

    // POST: /Document/Create
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(DocumentUploadViewModel model)
    {
        if (ModelState.IsValid)
        {
            if (model.UploadedFile != null && model.UploadedFile.Length > 0)
            {
                var uploadFolder = Path.Combine(_env.ContentRootPath, "SecureDocuments");
                if (!Directory.Exists(uploadFolder))
                {
                    Directory.CreateDirectory(uploadFolder);
                }

                var uniqueFileName = $"{Guid.NewGuid()}_{Path.GetFileName(model.UploadedFile.FileName)}";
                var filePath = Path.Combine(uploadFolder, uniqueFileName);

                using (var fileStream = new FileStream(filePath, FileMode.Create))
                {
                    await model.UploadedFile.CopyToAsync(fileStream);
                }

                var newDoc = new EconomicDocument
                {
                    Title = model.Title,
                    Category = model.Category,
                    ReferenceNumber = model.ReferenceNumber,
                    Description = model.Description,
                    FileName = model.UploadedFile.FileName,
                    FilePath = filePath,
                    FileSize = model.UploadedFile.Length,
                    ContentType = model.UploadedFile.ContentType,
                    UploadedBy = User.Identity?.Name ?? "System",
                    UploadDate = DateTime.UtcNow
                };

                _context.EconomicDocuments.Add(newDoc);
                await _context.SaveChangesAsync();

                TempData["SuccessMessage"] = "Document uploaded successfully.";
                return RedirectToAction(nameof(Index));
            }
            ModelState.AddModelError("UploadedFile", "Please select a valid file.");
        }
        return View(model);
    }

    // GET: /Document/Download/5
    public async Task<IActionResult> Download(int id)
    {
        var document = await _context.EconomicDocuments.FindAsync(id);
        if (document == null) return NotFound();

        var path = document.FilePath;
        if (!System.IO.File.Exists(path)) return NotFound();

        var memory = new MemoryStream();
        using (var stream = new FileStream(path, FileMode.Open))
        {
            await stream.CopyToAsync(memory);
        }
        memory.Position = 0;
        return File(memory, document.ContentType ?? "application/octet-stream", document.FileName);
    }
}
