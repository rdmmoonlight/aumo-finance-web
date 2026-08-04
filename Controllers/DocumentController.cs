using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AumoFinance.Models;
using AumoFinance.Services;

namespace AumoFinance.Controllers;

public class DocumentController : Controller
{
    private readonly AppDbContext _context;
    private readonly ICloudStorageService _cloudStorageService;

    public DocumentController(AppDbContext context, ICloudStorageService cloudStorageService)
    {
        _context = context;
        _cloudStorageService = cloudStorageService;
    }

    // GET: /Document/?folderId=...&searchString=...&category=...
    public async Task<IActionResult> Index(Guid? folderId, string searchString, string category)
    {
        var userId = this.CurrentUserId();

        // --- PERIOD GATE ---
        var currentPeriod = await _context.Periods
            .FirstOrDefaultAsync(p => p.UserId == userId && p.IsSelected);

        if (currentPeriod == null)
        {
            ViewBag.NoPeriodSelected = true;

            var emptyViewModel = new DocumentIndexViewModel
            {
                Documents = new List<EconomicDocument>(),
                Folders = new List<Folder>(),
                CurrentFolderId = folderId,
                FolderBreadcrumbs = new List<Folder>(),
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

        // --- 1. AMBIL FOLDER AKTIF & BREADCRUMBS ---
        Folder? currentFolder = null;
        var breadcrumbs = new List<Folder>();

        if (folderId.HasValue)
        {
            currentFolder = await _context.Folders
                .FirstOrDefaultAsync(f => f.Id == folderId.Value && f.UserId == userId);

            // Susun breadcrumb navigasi (dari folder saat ini hingga root)
            var temp = currentFolder;
            while (temp != null)
            {
                breadcrumbs.Insert(0, temp);
                if (temp.ParentFolderId.HasValue)
                {
                    temp = await _context.Folders
                        .FirstOrDefaultAsync(f => f.Id == temp.ParentFolderId.Value && f.UserId == userId);
                }
                else
                {
                    temp = null;
                }
            }
        }

        // --- 2. AMBIL SUB-FOLDER DI FOLDER AKTIF ---
        var subFolders = await _context.Folders
            .Where(f => f.UserId == userId && f.ParentFolderId == folderId)
            .OrderBy(f => f.Name)
            .ToListAsync();

        // --- 3. QUERY DOKUMEN ---
        var query = _context.EconomicDocuments
            .Include(d => d.JournalEntry)
            .Where(d => d.UserId == userId &&
                        d.UploadDate >= currentPeriod.StartDate &&
                        d.UploadDate <= currentPeriod.EndDate)
            .AsQueryable();

        // Jika user melakukan pencarian global, abaikan batasan folder
        if (!string.IsNullOrEmpty(searchString))
        {
            query = query.Where(d => d.Title.Contains(searchString) ||
                                    (d.ReferenceNumber != null && d.ReferenceNumber.Contains(searchString)));
        }
        else
        {
            // Filter dokumen sesuai folder yang sedang dibuka
            query = query.Where(d => d.FolderId == folderId);
        }

        if (!string.IsNullOrEmpty(category))
        {
            query = query.Where(d => d.Category == category);
        }

        var documentList = await query.OrderByDescending(d => d.UploadDate).ToListAsync();

        // --- 4. STATISTICAL COMPUTATIONS (Di Periode Terpilih) ---
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
            Folders = subFolders,
            CurrentFolderId = folderId,
            CurrentFolder = currentFolder,
            FolderBreadcrumbs = breadcrumbs,

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

    // POST: /Document/CreateFolder
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateFolder(string name, Guid? parentFolderId)
    {
        var userId = this.CurrentUserId();

        if (string.IsNullOrWhiteSpace(name))
        {
            TempData["ErrorMessage"] = "Folder name cannot be empty.";
            return RedirectToAction(nameof(Index), new { folderId = parentFolderId });
        }

        var folder = new Folder
        {
            Id = Guid.NewGuid(),
            Name = name.Trim(),
            ParentFolderId = parentFolderId,
            UserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Folders.Add(folder);
        await _context.SaveChangesAsync();

        TempData["SuccessMessage"] = $"Folder '{folder.Name}' created successfully.";
        return RedirectToAction(nameof(Index), new { folderId = parentFolderId });
    }

    // POST: /Document/DeleteFolder/guid-id
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteFolder(Guid id)
    {
        var userId = this.CurrentUserId();
        var folder = await _context.Folders
            .FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);

        if (folder == null) return NotFound();

        var parentFolderId = folder.ParentFolderId;

        // Hapus folder (ON DELETE CASCADE di DB / EF Core akan menangani sub-folder & dokumen)
        _context.Folders.Remove(folder);
        await _context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Folder and its contents deleted successfully.";
        return RedirectToAction(nameof(Index), new { folderId = parentFolderId });
    }

    // GET: /Document/Create?folderId=...
    public async Task<IActionResult> Create(Guid? folderId)
    {
        var userId = this.CurrentUserId();

        var currentPeriod = await _context.Periods
            .FirstOrDefaultAsync(p => p.UserId == userId && p.IsSelected);

        if (currentPeriod == null)
        {
            TempData["ErrorMessage"] = "Please select an active accounting period before uploading documents.";
            return RedirectToAction(nameof(Index));
        }

        ViewBag.JournalEntries = await _context.JournalEntries
            .Where(j => j.UserId == userId &&
                        j.EntryDate >= currentPeriod.StartDate &&
                        j.EntryDate <= currentPeriod.EndDate)
            .OrderByDescending(j => j.Id)
            .Take(100)
            .ToListAsync();

        var model = new DocumentUploadViewModel
        {
            FolderId = folderId
        };

        return View(model);
    }

    // POST: /Document/Create
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(DocumentUploadViewModel model)
    {
        var userId = this.CurrentUserId();

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
                try
                {
                    // Tentukan folder penyimpanan Cloudinary berbasis UserId
                    string targetCloudFolder = $"aumo_finance_docs/user_{userId}";

                    // 1. Upload ke Cloudinary via Service
                    var (publicId, fileUrl, fileSize) = await _cloudStorageService.UploadFileAsync(
                        model.UploadedFile,
                        folderName: targetCloudFolder
                    );

                    // 2. Simpan metadata ke Database
                    var newDoc = new EconomicDocument
                    {
                        UserId = userId,
                        Title = model.Title,
                        Category = model.Category,
                        ReferenceNumber = model.ReferenceNumber,
                        JournalEntryId = model.JournalEntryId,
                        FolderId = model.FolderId, // Menyimpan lokasi folder Web
                        Description = model.Description,
                        FileName = model.UploadedFile.FileName,
                        FilePath = fileUrl,
                        CloudPublicId = publicId,
                        FileSize = fileSize,
                        ContentType = model.UploadedFile.ContentType,
                        UploadedBy = User.Identity?.Name ?? "System",
                        UploadDate = DateTime.UtcNow
                    };

                    _context.EconomicDocuments.Add(newDoc);
                    await _context.SaveChangesAsync();

                    TempData["SuccessMessage"] = "Document successfully uploaded to Cloud Storage and linked.";
                    return RedirectToAction(nameof(Index), new { folderId = model.FolderId });
                }
                catch (Exception ex)
                {
                    ModelState.AddModelError(string.Empty, $"Cloud Upload Failed: {ex.Message}");
                }
            }
            else
            {
                ModelState.AddModelError("UploadedFile", "Please select a valid file.");
            }
        }

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

        if (document == null || string.IsNullOrEmpty(document.FilePath))
            return NotFound();

        return Redirect(document.FilePath);
    }

    // POST: /Document/Delete/5
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = this.CurrentUserId();
        var document = await _context.EconomicDocuments.FirstOrDefaultAsync(d => d.Id == id && d.UserId == userId);

        if (document == null) return NotFound();

        var currentFolderId = document.FolderId;

        // 1. Hapus file dari Cloudinary jika Public ID tersedia
        if (!string.IsNullOrEmpty(document.CloudPublicId))
        {
            await _cloudStorageService.DeleteFileAsync(document.CloudPublicId);
        }

        // 2. Hapus record dari Database
        _context.EconomicDocuments.Remove(document);
        await _context.SaveChangesAsync();

        TempData["SuccessMessage"] = "Document deleted successfully from Cloud Storage.";
        return RedirectToAction(nameof(Index), new { folderId = currentFolderId });
    }
}
