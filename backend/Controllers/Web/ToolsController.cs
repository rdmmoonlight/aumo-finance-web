using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoFinance.Models;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoFinance.Controllers.Web
{
    [ApiController]
    [Route("web/tools")]
    [Authorize(AuthenticationSchemes = "Identity.Application")]
    public class ToolsWebController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ToolsWebController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("download-journal-template")]
        public IActionResult DownloadJournalTemplate()
        {
            using var workbook = new XLWorkbook();

            var wsGj = workbook.Worksheets.Add("GJ");
            wsGj.Cell(1, 1).Value = "Date";
            wsGj.Cell(1, 2).Value = "Account Name";
            wsGj.Cell(1, 3).Value = "Description";
            wsGj.Cell(1, 4).Value = "Ref";
            wsGj.Cell(1, 5).Value = "Debit";
            wsGj.Cell(1, 6).Value = "Credit";
            wsGj.Row(1).Style.Font.Bold = true;

            var wsAj = workbook.Worksheets.Add("AJ");
            wsAj.Cell(1, 1).Value = "Date";
            wsAj.Cell(1, 2).Value = "Account Name";
            wsAj.Cell(1, 3).Value = "Description";
            wsAj.Cell(1, 4).Value = "Ref";
            wsAj.Cell(1, 5).Value = "Debit";
            wsAj.Cell(1, 6).Value = "Credit";
            wsAj.Row(1).Style.Font.Bold = true;

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            var content = stream.ToArray();

            return File(
                content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "JournalImportTemplate.xlsx"
            );
        }

        // ==========================================
        // 2. POST: /web/tools/preview-journal-import (SIMULASI CUSTODY / CHECK)
        // ==========================================
        [HttpPost("preview-journal-import")]
        public async Task<IActionResult> PreviewJournalImport([FromBody] JournalImportRequestDto request)
        {
            if (request?.Transactions == null || !request.Transactions.Any())
            {
                return BadRequest(new { message = "No transaction data provided for preview." });
            }

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userIdStr, out var userId))
            {
                return Unauthorized();
            }

            var existingCoas = await _context.ChartOfAccounts
                .Where(c => c.UserId == userId)
                .ToListAsync();

            var reallocations = new List<ReallocationDetailDto>();
            var processedTransactions = new List<JournalTransactionDto>();

            foreach (var txDto in request.Transactions)
            {
                var processedLines = new List<JournalLineDto>();

                foreach (var lineDto in txDto.Lines)
                {
                    int refInt = lineDto.RefNumber;
                    string excelAccountName = lineDto.AccountName?.Trim() ?? string.Empty;

                    // Match A: By ReferenceNumber
                    var coa = existingCoas.FirstOrDefault(c => c.ReferenceNumber == refInt);

                    if (coa != null)
                    {
                        if (!string.Equals(coa.AccountName, excelAccountName, StringComparison.OrdinalIgnoreCase))
                        {
                            reallocations.Add(new ReallocationDetailDto
                            {
                                ExcelRef = refInt,
                                ExcelAccountName = excelAccountName,
                                MappedRef = coa.ReferenceNumber,
                                MappedAccountName = coa.AccountName,
                                Reason = "Nama akun Excel beda dengan master COA, dilimpahkan ke nama akun baku."
                            });
                        }

                        processedLines.Add(new JournalLineDto
                        {
                            RefNumber = coa.ReferenceNumber,
                            AccountName = coa.AccountName, // Gunakan nama baku
                            Description = lineDto.Description,
                            Debit = lineDto.Debit,
                            Credit = lineDto.Credit
                        });
                    }
                    else
                    {
                        // Match B: By AccountName
                        coa = existingCoas.FirstOrDefault(c =>
                            string.Equals(c.AccountName, excelAccountName, StringComparison.OrdinalIgnoreCase));

                        if (coa != null)
                        {
                            reallocations.Add(new ReallocationDetailDto
                            {
                                ExcelRef = refInt,
                                ExcelAccountName = excelAccountName,
                                MappedRef = coa.ReferenceNumber,
                                MappedAccountName = coa.AccountName,
                                Reason = "Ref number Excel tidak cocok, dilimpahkan ke Ref number baku master COA."
                            });

                            processedLines.Add(new JournalLineDto
                            {
                                RefNumber = coa.ReferenceNumber,
                                AccountName = coa.AccountName,
                                Description = lineDto.Description,
                                Debit = lineDto.Debit,
                                Credit = lineDto.Credit
                            });
                        }
                        else
                        {
                            // Match C: COA Baru
                            processedLines.Add(new JournalLineDto
                            {
                                RefNumber = refInt,
                                AccountName = excelAccountName,
                                Description = lineDto.Description,
                                Debit = lineDto.Debit,
                                Credit = lineDto.Credit
                            });
                        }
                    }
                }

                processedTransactions.Add(new JournalTransactionDto
                {
                    Date = txDto.Date,
                    JournalType = txDto.JournalType,
                    Lines = processedLines
                });
            }

            // Deduplicate reallocation details for display
            var uniqueReallocations = reallocations
                .GroupBy(r => new { r.ExcelRef, r.ExcelAccountName, r.MappedRef, r.MappedAccountName })
                .Select(g => g.First())
                .ToList();

            return Ok(new
            {
                transactions = processedTransactions,
                reallocations = uniqueReallocations
            });
        }

        // ==========================================
        // 3. POST: /web/tools/import-journal-entries (SIMPAN PERMANEN)
        // ==========================================
        [HttpPost("import-journal-entries")]
        public async Task<IActionResult> ImportJournalEntries([FromBody] JournalImportRequestDto request)
        {
            if (request?.Transactions == null || !request.Transactions.Any())
            {
                return BadRequest(new { message = "No transaction data provided for import." });
            }

            if (request.TargetMonth < 1 || request.TargetMonth > 12 || request.TargetYear < 2000)
            {
                return BadRequest(new { message = "Invalid period parameters provided." });
            }

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userIdStr, out var userId))
            {
                return Unauthorized();
            }

            using var dbTransaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var period = await _context.Periods.FirstOrDefaultAsync(p =>
                    p.UserId == userId &&
                    p.StartDate.Year == request.TargetYear &&
                    p.StartDate.Month == request.TargetMonth
                );

                if (period == null)
                {
                    period = new Period
                    {
                        UserId = userId,
                        StartDate = DateTime.SpecifyKind(new DateTime(request.TargetYear, request.TargetMonth, 1), DateTimeKind.Utc),
                        EndDate = DateTime.SpecifyKind(new DateTime(request.TargetYear, request.TargetMonth, DateTime.DaysInMonth(request.TargetYear, request.TargetMonth)), DateTimeKind.Utc),
                        IsClosed = false
                    };
                    _context.Periods.Add(period);
                    await _context.SaveChangesAsync();
                }

                var existingCoas = await _context.ChartOfAccounts
                    .Where(c => c.UserId == userId)
                    .ToListAsync();

                int createdCoaCount = 0;

                foreach (var txDto in request.Transactions)
                {
                    if (!DateTime.TryParse(txDto.Date, out var txDate))
                    {
                        continue;
                    }

                    txDate = DateTime.SpecifyKind(txDate, DateTimeKind.Utc);

                    string prefix = txDto.JournalType.Equals("Adjusting", StringComparison.OrdinalIgnoreCase) ? "AJ" : "GJ";
                    string counterKey = $"{prefix}{txDate:yyMM}";

                    var counter = await _context.TransactionCounters.FirstOrDefaultAsync(c =>
                        c.UserId == userId &&
                        c.CounterKey == counterKey
                    );

                    if (counter == null)
                    {
                        counter = new TransactionCounter
                        {
                            UserId = userId,
                            CounterKey = counterKey,
                            LastSequence = 1
                        };
                        _context.TransactionCounters.Add(counter);
                    }
                    else
                    {
                        counter.LastSequence += 1;
                    }

                    string transactionNumber = $"{counterKey}{counter.LastSequence:D4}";

                    var journalEntry = new JournalEntry
                    {
                        UserId = userId,
                        TransactionNumber = transactionNumber,
                        JournalType = txDto.JournalType,
                        CreatedAt = txDate,
                        Lines = new List<JournalEntryLine>()
                    };

                    foreach (var lineDto in txDto.Lines)
                    {
                        int refInt = lineDto.RefNumber;
                        string excelAccountName = lineDto.AccountName?.Trim() ?? string.Empty;

                        var coa = existingCoas.FirstOrDefault(c => c.ReferenceNumber == refInt);

                        if (coa == null)
                        {
                            coa = existingCoas.FirstOrDefault(c =>
                                string.Equals(c.AccountName, excelAccountName, StringComparison.OrdinalIgnoreCase));

                            if (coa == null)
                            {
                                coa = new ChartOfAccount
                                {
                                    UserId = userId,
                                    ReferenceNumber = refInt,
                                    AccountName = excelAccountName,
                                    IsActive = true
                                };
                                _context.ChartOfAccounts.Add(coa);
                                await _context.SaveChangesAsync();

                                existingCoas.Add(coa);
                                createdCoaCount++;
                            }
                        }

                        journalEntry.Lines.Add(new JournalEntryLine
                        {
                            AccountId = coa.Id,
                            LineDescription = lineDto.Description,
                            Debit = lineDto.Debit ?? 0m,
                            Credit = lineDto.Credit ?? 0m
                        });
                    }

                    _context.JournalEntries.Add(journalEntry);
                }

                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();

                return Ok(new
                {
                    message = "Journal data successfully imported.",
                    createdCoaCount = createdCoaCount
                });
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = $"Failed to save data: {ex.Message}" });
            }
        }
    }

    public class JournalImportRequestDto
    {
        public int TargetMonth { get; set; }
        public int TargetYear { get; set; }
        public List<JournalTransactionDto> Transactions { get; set; } = new();
    }

    public class JournalTransactionDto
    {
        public string Date { get; set; } = string.Empty;
        public string JournalType { get; set; } = string.Empty;
        public List<JournalLineDto> Lines { get; set; } = new();
    }

    public class JournalLineDto
    {
        public int RefNumber { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal? Debit { get; set; }
        public decimal? Credit { get; set; }
    }

    public class ReallocationDetailDto
    {
        public int ExcelRef { get; set; }
        public string ExcelAccountName { get; set; } = string.Empty;
        public int MappedRef { get; set; }
        public string MappedAccountName { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
    }
}
