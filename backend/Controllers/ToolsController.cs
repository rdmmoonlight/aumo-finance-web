using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AumoBackend.Models;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AumoBackend.Controllers.Web
{
    [ApiController]
    [Route("api/v1/tools")]
    [Authorize(AuthenticationSchemes = "Identity.Application")]
    public class ToolsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ToolsController(AppDbContext context)
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
        // 1. POST: /web/tools/preview-journal-import
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
                .AsNoTracking()
                .Where(c => c.UserId == userId && c.IsActive)
                .ToListAsync();

            var mappingDetails = new List<AccountMappingDetailDto>();
            var processedTransactions = new List<JournalTransactionDto>();
            var counterMemory = new Dictionary<string, int>();

            foreach (var txDto in request.Transactions)
            {
                if (!DateTime.TryParse(txDto.Date, out var rawTxDate))
                {
                    continue;
                }

                // Paksa Tahun & Bulan mengikuti Target
                int day = Math.Min(rawTxDate.Day, DateTime.DaysInMonth(request.TargetYear, request.TargetMonth));
                var txDate = DateTime.SpecifyKind(new DateTime(request.TargetYear, request.TargetMonth, day), DateTimeKind.Utc);

                string prefix = txDto.JournalType.Equals("Adjusting", StringComparison.OrdinalIgnoreCase) ? "AJ" : "GJ";
                string counterKey = $"{prefix}{txDate:yyMM}";

                if (!counterMemory.ContainsKey(counterKey))
                {
                    var existingCounter = await _context.TransactionCounters
                        .AsNoTracking()
                        .FirstOrDefaultAsync(c => c.UserId == userId && c.CounterKey == counterKey);

                    counterMemory[counterKey] = existingCounter?.LastSequence ?? 0;
                }

                counterMemory[counterKey] += 1;
                string generatedTxNumber = $"{counterKey}{counterMemory[counterKey]:D5}";

                var processedLines = new List<JournalLineDto>();

                foreach (var lineDto in txDto.Lines)
                {
                    int refInt = lineDto.RefNumber;
                    string excelAccountName = lineDto.AccountName?.Trim() ?? string.Empty;

                    var coa = existingCoas.FirstOrDefault(c => c.ReferenceNumber == refInt && string.Equals(c.AccountName, excelAccountName, StringComparison.OrdinalIgnoreCase));

                    if (coa != null)
                    {
                        mappingDetails.Add(new AccountMappingDetailDto
                        {
                            ExcelRef = refInt,
                            ExcelAccountName = excelAccountName,
                            MappedRef = coa.ReferenceNumber,
                            MappedAccountName = coa.AccountName,
                            Status = "EXACT_MATCH",
                            Reason = "Nomor Ref dan Nama Akun cocok 100% presisi dengan Master COA."
                        });
                    }
                    else
                    {
                        mappingDetails.Add(new AccountMappingDetailDto
                        {
                            ExcelRef = refInt,
                            ExcelAccountName = excelAccountName,
                            MappedRef = 0,
                            MappedAccountName = string.Empty,
                            Status = "UNMAPPED",
                            Reason = "Silakan pilih akun pelimpahan manual dari dropdown."
                        });
                    }

                    processedLines.Add(new JournalLineDto
                    {
                        RefNumber = refInt,
                        AccountName = excelAccountName,
                        Description = lineDto.Description,
                        Debit = lineDto.Debit,
                        Credit = lineDto.Credit
                    });
                }

                processedTransactions.Add(new JournalTransactionDto
                {
                    TransactionNumber = generatedTxNumber,
                    Date = txDate.ToString("yyyy-MM-dd"),
                    JournalType = txDto.JournalType,
                    Lines = processedLines
                });
            }

            var uniqueMappings = mappingDetails
                .GroupBy(m => new { m.ExcelRef, m.ExcelAccountName })
                .Select(g => g.First())
                .ToList();

            int exactMatchCount = uniqueMappings.Count(m => m.Status == "EXACT_MATCH");
            int reallocatedCount = uniqueMappings.Count(m => m.Status == "REALLOCATED_NAME" || m.Status == "REALLOCATED_REF");
            int unmappedCount = uniqueMappings.Count(m => m.Status == "UNMAPPED" || m.MappedRef == 0);

            return Ok(new
            {
                transactions = processedTransactions,
                accountMappings = uniqueMappings,
                summary = new
                {
                    totalUniqueAccounts = uniqueMappings.Count,
                    exactMatchCount = exactMatchCount,
                    reallocatedCount = reallocatedCount,
                    unmappedCount = unmappedCount,
                    isPerfectMatch = (unmappedCount == 0)
                }
            });
        }

        // ==========================================
        // 2. POST: /web/tools/import-journal-entries
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
                // Cek / Buat Periode Akuntansi dengan Format "September 2026"
                var period = await _context.Periods.FirstOrDefaultAsync(p =>
                    p.UserId == userId &&
                    p.StartDate.Year == request.TargetYear &&
                    p.StartDate.Month == request.TargetMonth
                );

                if (period == null)
                {
                    var monthName = new DateTime(request.TargetYear, request.TargetMonth, 1)
                        .ToString("MMMM yyyy", new CultureInfo("id-ID"));

                    period = new Period
                    {
                        UserId = userId,
                        PeriodName = monthName,
                        StartDate = DateTime.SpecifyKind(new DateTime(request.TargetYear, request.TargetMonth, 1), DateTimeKind.Utc),
                        EndDate = DateTime.SpecifyKind(new DateTime(request.TargetYear, request.TargetMonth, DateTime.DaysInMonth(request.TargetYear, request.TargetMonth)), DateTimeKind.Utc),
                        IsClosed = false,
                        IsSelected = false
                    };
                    _context.Periods.Add(period);
                    await _context.SaveChangesAsync();
                }

                var existingCoas = await _context.ChartOfAccounts
                    .Where(c => c.UserId == userId && c.IsActive)
                    .ToListAsync();

                var mappingDict = request.CustomMappings?
                    .Where(m => m.MappedRef > 0)
                    .ToDictionary(
                        m => $"{m.ExcelRef}|||{m.ExcelAccountName.Trim()}",
                        m => m,
                        StringComparer.OrdinalIgnoreCase
                    ) ?? new Dictionary<string, AccountMappingDetailDto>();

                var existingTxNumbers = await _context.JournalEntries
                    .Where(j => j.UserId == userId)
                    .Select(j => j.TransactionNumber)
                    .ToHashSetAsync();

                var activeCounters = new Dictionary<string, TransactionCounter>();

                int importedEntriesCount = 0;

                foreach (var txDto in request.Transactions)
                {
                    if (!DateTime.TryParse(txDto.Date, out var rawTxDate))
                    {
                        continue;
                    }

                    // PAKSA TANGGAL MENGGUNAKAN TARGET MONTH & TARGET YEAR
                    int day = Math.Min(rawTxDate.Day, DateTime.DaysInMonth(request.TargetYear, request.TargetMonth));
                    var txDate = DateTime.SpecifyKind(new DateTime(request.TargetYear, request.TargetMonth, day), DateTimeKind.Utc);

                    string prefix = txDto.JournalType.Equals("Adjusting", StringComparison.OrdinalIgnoreCase) ? "AJ" : "GJ";
                    string counterKey = $"{prefix}{txDate:yyMM}"; // Akan Selalu Menjadi GJ2609!

                    if (!activeCounters.TryGetValue(counterKey, out var counter))
                    {
                        counter = await _context.TransactionCounters.FirstOrDefaultAsync(c =>
                            c.UserId == userId &&
                            c.CounterKey == counterKey
                        );

                        if (counter == null)
                        {
                            counter = new TransactionCounter
                            {
                                UserId = userId,
                                CounterKey = counterKey,
                                LastSequence = 0
                            };
                            _context.TransactionCounters.Add(counter);
                        }

                        activeCounters[counterKey] = counter;
                    }

                    counter.LastSequence += 1;
                    string transactionNumber = $"{counterKey}{counter.LastSequence:D5}";

                    while (existingTxNumbers.Contains(transactionNumber))
                    {
                        counter.LastSequence += 1;
                        transactionNumber = $"{counterKey}{counter.LastSequence:D5}";
                    }

                    existingTxNumbers.Add(transactionNumber);

                    var journalEntry = new JournalEntry
                    {
                        UserId = userId,
                        TransactionNumber = transactionNumber,
                        JournalType = txDto.JournalType,
                        EntryDate = txDate,
                        CreatedAt = txDate,
                        Lines = new List<JournalEntryLine>()
                    };

                    foreach (var lineDto in txDto.Lines)
                    {
                        int excelRef = lineDto.RefNumber;
                        string excelAccountName = lineDto.AccountName?.Trim() ?? string.Empty;

                        int targetRef = excelRef;

                        string mapKey = $"{excelRef}|||{excelAccountName}";
                        if (mappingDict.TryGetValue(mapKey, out var customMap))
                        {
                            targetRef = customMap.MappedRef;
                        }

                        var coa = existingCoas.FirstOrDefault(c => c.ReferenceNumber == targetRef);

                        if (coa == null)
                        {
                            continue;
                        }

                        journalEntry.Lines.Add(new JournalEntryLine
                        {
                            AccountId = coa.Id,
                            LineDescription = lineDto.Description,
                            Debit = lineDto.Debit ?? 0m,
                            Credit = lineDto.Credit ?? 0m
                        });
                    }

                    if (journalEntry.Lines.Any())
                    {
                        _context.JournalEntries.Add(journalEntry);
                        importedEntriesCount++;
                    }
                }

                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();

                return Ok(new
                {
                    message = "Journal data successfully imported.",
                    importedEntriesCount = importedEntriesCount
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
        public List<AccountMappingDetailDto>? CustomMappings { get; set; } = new();
    }

    public class JournalTransactionDto
    {
        public string TransactionNumber { get; set; } = string.Empty;
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

    public class AccountMappingDetailDto
    {
        public int ExcelRef { get; set; }
        public string ExcelAccountName { get; set; } = string.Empty;
        public int MappedRef { get; set; }
        public string MappedAccountName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
    }
}
