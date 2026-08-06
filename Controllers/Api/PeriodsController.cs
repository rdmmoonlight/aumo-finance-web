using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoFinance.Models;
using AumoFinance.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Controllers.Api;

[ApiController]
[Route("api/mobile/periods")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class PeriodsController : ControllerBase
{
    private readonly AppDbContext _db;

    public PeriodsController(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /api/mobile/periods (Period List & Selection Status)
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetPeriods()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var periods = await _db.Periods
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.StartDate)
            .Select(p => new
            {
                p.Id,
                p.PeriodName,
                p.StartDate,
                p.EndDate,
                p.IsClosed
            })
            .ToListAsync();

        var selectedPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);

        return Ok(new
        {
            success = true,
            selectedPeriodId = selectedPeriod?.Id,
            periods = periods
        });
    }

    // ==========================================
    // 2. POST: /api/mobile/periods/create (Open New Period)
    // ==========================================
    [HttpPost("create")]
    public async Task<IActionResult> CreatePeriod([FromBody] CreatePeriodRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.PeriodName))
            return BadRequest(new { success = false, message = "Period name is required." });

        if (request.StartDate > request.EndDate)
            return BadRequest(new { success = false, message = "Start date cannot be later than end date." });

        // Check for overlapping period dates
        var isOverlap = await _db.Periods.AnyAsync(p => p.UserId == userId &&
            ((request.StartDate >= p.StartDate && request.StartDate <= p.EndDate) ||
             (request.EndDate >= p.StartDate && request.EndDate <= p.EndDate)));

        if (isOverlap)
            return BadRequest(new { success = false, message = "The selected period dates overlap with an existing period." });

        var newPeriod = new Period
        {
            UserId = userId,
            PeriodName = request.PeriodName.Trim(),
            StartDate = DateTime.SpecifyKind(request.StartDate, DateTimeKind.Utc),
            EndDate = DateTime.SpecifyKind(request.EndDate, DateTimeKind.Utc),
            IsClosed = false
        };

        _db.Periods.Add(newPeriod);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"Period {newPeriod.PeriodName} has been opened successfully.",
            periodId = newPeriod.Id
        });
    }

    // ==========================================
    // 3. POST: /api/mobile/periods/select/{id} (Set Active/Viewing)
    // ==========================================
    [HttpPost("select/{id}")]
    public async Task<IActionResult> SelectPeriod(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var entity = await _db.Periods.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
        if (entity == null)
            return NotFound(new { success = false, message = "Accounting period not found." });

        await SelectedPeriodHelper.SelectPeriodAsync(_db, userId, entity.Id);

        return Ok(new
        {
            success = true,
            message = $"Now viewing {entity.PeriodName}" + (entity.IsClosed ? " (Closed)." : ".")
        });
    }

    // ==========================================
    // 4. POST: /api/mobile/periods/clear-selection (Stop Viewing)
    // ==========================================
    [HttpPost("clear-selection")]
    public async Task<IActionResult> ClearSelection()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        await SelectedPeriodHelper.ClearSelectionAsync(_db, userId);

        return Ok(new
        {
            success = true,
            message = "Period selection cleared."
        });
    }

    // ==========================================
    // 5. POST: /api/mobile/periods/close/{id} (Close Period)
    // ==========================================
    [HttpPost("close/{id}")]
    public async Task<IActionResult> ClosePeriod(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var entity = await _db.Periods.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
        if (entity == null)
            return NotFound(new { success = false, message = "Accounting period not found." });

        if (entity.IsClosed)
            return BadRequest(new { success = false, message = $"Period {entity.PeriodName} is already closed." });

        // Validation: Cannot close period if an earlier period is still open
        var hasEarlierOpenPeriod = await _db.Periods
            .AnyAsync(p => p.UserId == userId && p.Id != entity.Id && p.StartDate < entity.StartDate && !p.IsClosed);

        if (hasEarlierOpenPeriod)
            return BadRequest(new { success = false, message = $"Cannot close {entity.PeriodName}: an earlier period is still open. Close earlier periods first." });

        entity.IsClosed = true;
        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"Period {entity.PeriodName} has been closed. Transactions in this period are now locked."
        });
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class CreatePeriodRequest
{
    public string PeriodName { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
}
