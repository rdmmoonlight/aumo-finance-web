using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
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
    public async Task<IActionResult> Index(string searchString, string category)
    {
        var userId = this.CurrentUserId();

        // --- PERIOD GATE ---
        // 1. Ambil periode yang sedang di-view/dipilih oleh user (IsSelected = true)
        var currentPeriod = await _context.Periods
                                          .FirstOrDefaultAsync(p => p.UserId == userId && p.IsSelected);

        if (currentPeriod == null)
        {
            ViewBag.NoPeriodSelected = true;

            var emptyViewModel = new DocumentIndexViewModel
            {
                Documents = new List<EconomicDocument>(),
                TotalDocuments = 0,
                TotalStorageMB = 0,
                AddedLast7Days = 0,
                MostFrequentCategory = "-",
                AverageFileSizeKB = 0,
                AppDeploymentDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                AppAgeDays = 1,
                TotalJournalEntries = 0,
                TotalChartOfAccounts = 0,
                TotalActivePeriods = await _context.Periods.CountAsync(p => p.UserId == userId),
                TotalSystemUsers = await _context.Users.CountAsync()
            };

            return View(emptyViewModel);
        }

        ViewBag.NoPeriodSelected = false;
        ViewBag.PeriodName = currentPeriod.PeriodName;

        // 2. Query Dokumen yang terikat dengan rentang tanggal Periode Terpilih
        var query = _context.EconomicDocuments
                            .Include(d => d.JournalEntry)
                            .Where(d => d.UserId == userId &&
                                        d.UploadDate >= currentPeriod.StartDate &&
                                        d.UploadDate <= currentPeriod.EndDate)
                            .AsQueryable();

        if (!string.IsNullOrEmpty(searchString))
        {
            query = query.Where(d => d.Title.Contains(searchString) ||
                                       (d.ReferenceNumber != null && d.ReferenceNumber.Contains(searchString)));
        }

        if (!string.IsNullOrEmpty(category))
        {
            query = query.Where(d => d.Category == category);
        }

        var documentList = await query.OrderByDescending(d => d.UploadDate).ToListAsync();

        // --- Statistical Computations (Khusus Dokumen di Periode Terpilih) ---
        var allDocsInPeriod = await _context.EconomicDocuments
                                            .Where(d => d.UserId == userId &&
                                                        d.UploadDate >= currentPeriod.StartDate &&
                                                        d.UploadDate <= currentPeriod.EndDate)
                                            .ToListAsync();

        var totalBytes = allDocsInPeriod.Sum(d => d.FileSize);

        var topCategory = allDocsInPeriod.GroupBy(d => d.Category)
                                         .OrderByDescending(g => g.Count())
                                         .Select(g => g.Key)
                                         .FirstOrDefault() ?? "-";

        var deploymentDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var ageInDays = (int)(DateTime.UtcNow - deploymentDate).TotalDays;

        var viewModel = new DocumentIndexViewModel
        {
            Documents = documentList,
            TotalDocuments = allDocsInPeriod.Count,
            TotalStorageMB = Math.Round((double)totalBytes / (1024 * 1024), 2),
            AddedLast7Days = allDocsInPeriod.Count(d => d.UploadDate >= DateTime.UtcNow.AddDays(-7)),
            MostFrequentCategory = topCategory,
            AverageFileSizeKB = allDocsInPeriod.Any() ? Math.Round((double)totalBytes / allDocsInPeriod.Count / 1024, 2) : 0,

            // System & Accounting Metrics
            AppDeploymentDate = deploymentDate,
            AppAgeDays = ageInDays > 0 ? ageInDays : 1,
            TotalJournalEntries = await _context.JournalEntries.CountAsync(j => j.UserId == userId && j.EntryDate >= currentPeriod.StartDate && j.EntryDate <= currentPeriod.EndDate),
            TotalChartOfAccounts = await _context.ChartOfAccounts.CountAsync(a => a.UserId == userId),
            TotalActivePeriods = await _context.Periods.CountAsync(p => p.UserId == userId),
            TotalSystemUsers = await _context.Users.CountAsync()
        };

        return View(viewModel);
    }

    // GET: /Document/Create
    public async Task<IActionResult> Create()
    {
        var userId = this.CurrentUserId();

        // Gate: Cek apakah ada periode yang sedang di-select
        var currentPeriod = await _context.Periods
                                          .FirstOrDefaultAsync(p => p.UserId == userId && p.IsSelected);

        if (currentPeriod == null)
        {
            TempData["ErrorMessage"] = "Please select an active accounting period before uploading documents.";
            return RedirectToAction(nameof(Index));
        }

        // Tampilkan hanya Journal Entry yang sesuai dengan Periode Terpilih
        ViewBag.JournalEntries = await _context.JournalEntries
            .Where(j => j.UserId == userId &&
                        j.EntryDate >= currentPeriod.StartDate &&
                        j.EntryDate <= currentPeriod.EndDate)
            .OrderByDescending(j => j.Id)
            .Take(100)
            .ToListAsync();

        return View();
    }

    // POST: /Document/Create
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(DocumentUploadViewModel model)
    {
        var userId = this.CurrentUserId();

        // Gate: Pastikan periode aktif terkonfirmasi saat submit
        var currentPeriod = await _context.Periods
                                          .FirstOrDefaultAsync(p => p.UserId == userId && p.IsSelected);

        if (currentPeriod == null)
        {
            TempData["ErrorMessage"] = "No active period selected.";
            return RedirectToAction(nameof(Index));
        }

        if (model.JournalEntryId.HasValue)
        {
            var ownsEntry = await _context.JournalEntries
                .AnyAsync(j => j.Id == model.JournalEntryId.Value && j.UserId == userId);
            if (!ownsEntry)
            {
                ModelState.AddModelError(string.Empty, "The selected journal entry is invalid.");
            }
        }

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
                    UserId = userId,
                    Title = model.Title,
                    Category = model.Category,
                    ReferenceNumber = model.ReferenceNumber,
                    JournalEntryId = model.JournalEntryId,
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

                TempData["SuccessMessage"] = "Document uploaded and linked to SSOT successfully.";
                return RedirectToAction(nameof(Index));
            }
            ModelState.AddModelError("UploadedFile", "Please select a valid file.");
        }

        // Jika gagal, muat ulang dropdown journal entries khusus periode terpilih
        ViewBag.JournalEntries = await _context.JournalEntries
            .Where(j => j.UserId == userId &&
                        j.EntryDate >= currentPeriod.StartDate &&
                        j.EntryDate <= currentPeriod.EndDate)
            .OrderByDescending(j => j.Id)
            .Take(100)
            .ToListAsync();

        return View(model);
    }

    // GET: /Document/Download/5
    public async Task<IActionResult> Download(int id)
    {
        var userId = this.CurrentUserId();
        var document = await _context.EconomicDocuments.FirstOrDefaultAsync(d => d.Id == id && d.UserId == userId);
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
