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
        var documents = _context.EconomicDocuments.AsQueryable();

        if (!string.IsNullOrEmpty(searchString))
        {
            documents = documents.Where(d => d.Title.Contains(searchString) || 
                                            (d.ReferenceNumber != null && d.ReferenceNumber.Contains(searchString)));
        }

        if (!string.IsNullOrEmpty(category))
        {
            documents = documents.Where(d => d.Category == category);
        }

        return View(documents.OrderByDescending(d => d.UploadDate).ToList());
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
                // Menentukan folder penyimpanan
                var uploadFolder = Path.Combine(_env.ContentRootPath, "SecureDocuments");
                if (!Directory.Exists(uploadFolder))
                {
                    Directory.CreateDirectory(uploadFolder);
                }

                // Penamaan file unik
                var uniqueFileName = $"{Guid.NewGuid()}_{Path.GetFileName(model.UploadedFile.FileName)}";
                var filePath = Path.Combine(uploadFolder, uniqueFileName);

                // Simpan file ke storage
                using (var fileStream = new FileStream(filePath, FileMode.Create))
                {
                    await model.UploadedFile.CopyToAsync(fileStream);
                }

                // Simpan metadata ke Database
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
        return File(memory, document.ContentType, document.FileName);
    }
}
