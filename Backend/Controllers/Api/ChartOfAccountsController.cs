using System;
using System.Collections.Generic;
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
[Route("api/mobile/chart-of-accounts")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class ChartOfAccountsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ChartOfAccountsController(AppDbContext db)
    {
        _db = db;
    }

    // ==========================================
    // 1. GET: /api/mobile/chart-of-accounts
    // ==========================================
    [HttpGet]
    public async Task<IActionResult> GetAccounts([FromQuery] string? search, [FromQuery] string? category)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var query = _db.ChartOfAccounts.Where(a => a.UserId == userId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(a => a.AccountName.ToLower().Contains(keyword)
                                  || a.ReferenceNumber.ToString().Contains(keyword));
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(a => a.Type == category);
        }

        var loadedAccounts = await query
            .OrderBy(a => a.ReferenceNumber)
            .ToListAsync();

        var accountIds = loadedAccounts.Select(a => a.Id).ToList();

        var currentPeriod = await SelectedPeriodHelper.GetSelectedPeriodAsync(_db, userId);

        if (currentPeriod == null)
        {
            foreach (var account in loadedAccounts)
            {
                account.Balance = 0;
            }
        }
        else
        {
            var accountBalances = await _db.JournalEntryLines
                .Where(j => accountIds.Contains(j.AccountId) &&
                            j.JournalEntry != null &&
                            j.JournalEntry.EntryDate >= currentPeriod.StartDate &&
                            j.JournalEntry.EntryDate <= currentPeriod.EndDate)
                .GroupBy(j => j.AccountId)
                .Select(g => new
                {
                    AccountId = g.Key,
                    TotalDebit = g.Sum(j => j.Debit),
                    TotalCredit = g.Sum(j => j.Credit)
                })
                .ToDictionaryAsync(x => x.AccountId);

            foreach (var account in loadedAccounts)
            {
                if (accountBalances.TryGetValue(account.Id, out var balance))
                {
                    account.Balance = AccountClassification.NormalBalanceIsDebit(account.Type)
                        ? balance.TotalDebit - balance.TotalCredit
                        : balance.TotalCredit - balance.TotalDebit;
                }
                else
                {
                    account.Balance = 0;
                }
            }
        }

        var result = loadedAccounts.Select(a => new
        {
            a.Id,
            a.ReferenceNumber,
            a.AccountName,
            a.Type,
            a.Role,
            a.IsActive,
            a.Balance
        });

        return Ok(new
        {
            success = true,
            selectedPeriodName = currentPeriod?.PeriodName,
            accounts = result
        });
    }

    // ==========================================
    // 2. POST: /api/mobile/chart-of-accounts/create
    // ==========================================
    [HttpPost("create")]
    public async Task<IActionResult> CreateAccount([FromBody] CreateAccountRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.AccountName))
            return BadRequest(new { success = false, message = "Account name is required." });

        if (string.IsNullOrWhiteSpace(request.Type))
            return BadRequest(new { success = false, message = "Account category type is required." });

        if (!AccountClassification.ValidateReferenceNumber(request.Type, request.ReferenceNumber))
        {
            return BadRequest(new { success = false, message = $"Invalid reference number {request.ReferenceNumber} for category {request.Type}." });
        }

        bool isCodeTaken = await _db.ChartOfAccounts
            .AnyAsync(a => a.UserId == userId && a.ReferenceNumber == request.ReferenceNumber);

        if (isCodeTaken)
        {
            return BadRequest(new { success = false, message = $"Account code {request.ReferenceNumber} is already in use." });
        }

        var newAccount = new ChartOfAccount
        {
            UserId = userId,
            ReferenceNumber = request.ReferenceNumber,
            AccountName = request.AccountName.Trim(),
            Type = request.Type,
            Role = string.IsNullOrWhiteSpace(request.Role) ? "Default" : request.Role,
            IsActive = true,
            Balance = 0
        };

        try
        {
            _db.ChartOfAccounts.Add(newAccount);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = $"Account '{newAccount.AccountName}' successfully created.",
                accountId = newAccount.Id
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { success = false, message = $"A fatal error occurred while saving the account: {ex.Message}" });
        }
    }

    // ==========================================
    // 3. PUT: /api/mobile/chart-of-accounts/update/{id}
    // ==========================================
    [HttpPut("update/{id:int}")]
    public async Task<IActionResult> UpdateAccount(int id, [FromBody] UpdateAccountRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var account = await _db.ChartOfAccounts
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);

        if (account == null)
        {
            return NotFound(new { success = false, message = "Account not found." });
        }

        if (string.IsNullOrWhiteSpace(request.AccountName))
            return BadRequest(new { success = false, message = "Account name is required." });

        if (!AccountClassification.ValidateReferenceNumber(request.Type, request.ReferenceNumber))
        {
            return BadRequest(new { success = false, message = $"Invalid reference number {request.ReferenceNumber} for category {request.Type}." });
        }

        bool isCodeTaken = await _db.ChartOfAccounts
            .AnyAsync(a => a.UserId == userId && a.ReferenceNumber == request.ReferenceNumber && a.Id != id);

        if (isCodeTaken)
        {
            return BadRequest(new { success = false, message = $"Account code {request.ReferenceNumber} is already in use." });
        }

        account.ReferenceNumber = request.ReferenceNumber;
        account.AccountName = request.AccountName.Trim();
        account.Type = request.Type;
        account.Role = string.IsNullOrWhiteSpace(request.Role) ? "Default" : request.Role;
        account.IsActive = request.IsActive;

        try
        {
            await _db.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = $"Account '{account.AccountName}' successfully updated."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { success = false, message = $"A fatal error occurred while updating the account: {ex.Message}" });
        }
    }

    // ==========================================
    // 4. DELETE: /api/mobile/chart-of-accounts/delete/{id}
    // ==========================================
    [HttpDelete("delete/{id:int}")]
    public async Task<IActionResult> DeleteAccount(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var entity = await _db.ChartOfAccounts
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);

        if (entity == null)
        {
            return NotFound(new { success = false, message = "Account not found." });
        }

        bool hasJournalLines = await _db.JournalEntryLines.AnyAsync(l => l.AccountId == id);
        if (hasJournalLines)
        {
            return BadRequest(new { success = false, message = $"Account '{entity.AccountName}' cannot be deleted because it already has journal entries. Set it to Inactive instead." });
        }

        try
        {
            _db.ChartOfAccounts.Remove(entity);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = $"Account '{entity.AccountName}' successfully deleted."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { success = false, message = $"A fatal error occurred while deleting the account: {ex.Message}" });
        }
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdStr, out Guid userId) ? userId : Guid.Empty;
    }
}

public class CreateAccountRequest
{
    public int ReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Role { get; set; } = "Default";
}

public class UpdateAccountRequest
{
    public int ReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Role { get; set; } = "Default";
    public bool IsActive { get; set; }
}
