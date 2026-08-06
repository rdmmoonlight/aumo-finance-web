using System.Globalization;
using System.Security.Claims;
using AumoFinance.Models;
using AumoFinance.Models.DTOs;
using AumoFinance.Services;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Components.Forms;
using Microsoft.EntityFrameworkCore;
using Microsoft.JSInterop;

namespace AumoFinance.Components.Pages.Tools;

public partial class ImportJournalPage : ComponentBase
{
    [Inject] protected AppDbContext DbContext { get; set; } = default!;
    [Inject] protected IJSRuntime JS { get; set; } = default!;
    [Inject] protected AuthenticationStateProvider AuthStateProvider { get; set; } = default!;
    [Inject] protected NavigationManager Nav { get; set; } = default!;

    protected static readonly CultureInfo Idr = new("id-ID");
    protected Guid UserId { get; private set; }

    protected const long MaxFileSizeBytes = 20 * 1024 * 1024; // 20 MB

    protected IBrowserFile? selectedFile;
    protected JournalImportResultDto? parseResult;
    protected string? successMessage;
    protected string? errorMessage;
    protected bool isBusy;

    protected override async Task OnInitializedAsync()
    {
        var authState = await AuthStateProvider.GetAuthenticationStateAsync();
        var user = authState.User;

        if (user.Identity?.IsAuthenticated == true)
        {
            var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var parsedId))
            {
                UserId = parsedId;
                return;
            }
        }

        Nav.NavigateTo("/Account/Login", true);
    }

    protected void OnFileSelected(InputFileChangeEventArgs e)
    {
        selectedFile = e.File;
        parseResult = null;
        errorMessage = null;
    }

    protected async Task HandlePreview()
    {
        if (selectedFile == null || UserId == Guid.Empty) return;

        errorMessage = null;
        isBusy = true;
        try
        {
            using var stream = new MemoryStream();
            await using (var uploadStream = selectedFile.OpenReadStream(MaxFileSizeBytes))
            {
                await uploadStream.CopyToAsync(stream);
            }
            stream.Position = 0;

            var result = await ParseJournalExcelAsync(stream);
            if (!result.IsSuccess)
            {
                errorMessage = result.Message;
                return;
            }

            parseResult = result;
            await JS.InvokeVoidAsync("aumoModal.show", "previewModal");
        }
        catch (Exception ex)
        {
            errorMessage = $"An error occurred while parsing the file: {ex.Message}";
        }
        finally
        {
            isBusy = false;
        }
    }

    protected async Task<JournalImportResultDto> ParseJournalExcelAsync(Stream stream)
    {
        var result = new JournalImportResultDto();

        try
        {
            using var workbook = new XLWorkbook(stream);

            var existingRefNumbers = await DbContext.ChartOfAccounts
                .Where(a => a.UserId == UserId)
                .Select(a => a.ReferenceNumber)
                .ToListAsync();

            var sheetMap = new (string SheetName, string JournalType)[]
            {
                ("GJ", "General"),
                ("AJ", "Adjusting")
            };

            foreach (var (sheetName, journalType) in sheetMap)
            {
                if (!workbook.Worksheets.TryGetWorksheet(sheetName, out var sheet))
                    continue;

                var lastRow = sheet.LastRowUsed()?.RowNumber() ?? 1;
                JournalTransactionImportDto? currentTx = null;

                for (int r = 2; r <= lastRow; r++)
                {
                    var dateCell = sheet.Cell(r, 1);
                    var accountCell = sheet.Cell(r, 2);
                    var descCell = sheet.Cell(r, 3);
                    var refCell = sheet.Cell(r, 4);
                    var debitCell = sheet.Cell(r, 5);
                    var creditCell = sheet.Cell(r, 6);

                    if (dateCell.IsEmpty() && accountCell.IsEmpty() && refCell.IsEmpty())
                        continue;

                    if (!dateCell.IsEmpty())
                    {
                        if (dateCell.TryGetValue(out DateTime parsedDate))
                        {
                            currentTx = new JournalTransactionImportDto
                            {
                                Date = parsedDate.Date,
                                JournalType = journalType
                            };
                            result.Transactions.Add(currentTx);
                        }
                        else
                        {
                            result.Warnings.Add($"{sheetName} Row {r}: Invalid date format.");
                            continue;
                        }
                    }

                    if (currentTx == null) continue;

                    decimal? debitValue = null;
                    if (!debitCell.IsEmpty() && debitCell.TryGetValue(out decimal dVal)) debitValue = dVal;

                    decimal? creditValue = null;
                    if (!creditCell.IsEmpty() && creditCell.TryGetValue(out decimal cVal)) creditValue = cVal;

                    refCell.TryGetValue(out int refNum);

                    currentTx.Lines.Add(new JournalLineImportDto
                    {
                        RowIndex = r,
                        AccountName = accountCell.GetString().Trim(),
                        Description = descCell.GetString().Trim(),
                        RefNumber = refNum,
                        Debit = debitValue,
                        Credit = creditValue,
                        IsNewAccount = !existingRefNumbers.Contains(refNum)
                    });

                    result.TotalLinesRead++;
                }
            }

            result.TotalTransactionsRead = result.Transactions.Count;
            result.IsSuccess = true;
        }
        catch (Exception ex)
        {
            result.IsSuccess = false;
            result.Message = $"Excel Parsing Error: {ex.Message}";
        }

        return result;
    }

    protected async Task HandleConfirmImport()
    {
        if (parseResult == null || !parseResult.Transactions.Any() || UserId == Guid.Empty)
        {
            errorMessage = "No valid transactions to import.";
            return;
        }

        isBusy = true;
        try
        {
            int accountsCreated = 0;
            int transactionsImported = 0;

            var seqCounters = new Dictionary<string, int>();
            async Task<int> NextSeqAsync(string prefix)
            {
                if (!seqCounters.TryGetValue(prefix, out var seq))
                {
                    var last = await DbContext.JournalEntries
                        .Where(e => e.UserId == UserId && e.ReferenceNumber.StartsWith(prefix + "-"))
                        .OrderByDescending(e => e.Id)
                        .Select(e => e.ReferenceNumber)
                        .FirstOrDefaultAsync();

                    seq = 0;
                    if (last != null)
                    {
                        var parts = last.Split('-');
                        if (parts.Length == 2 && int.TryParse(parts[1], out var lastSeq))
                        {
                            seq = lastSeq;
                        }
                    }
                }
                seq += 1;
                seqCounters[prefix] = seq;
                return seq;
            }

            foreach (var txDto in parseResult.Transactions)
            {
                var entryLines = new List<JournalEntryLine>();

                foreach (var lineDto in txDto.Lines)
                {
                    var account = await DbContext.ChartOfAccounts
                        .FirstOrDefaultAsync(a => a.ReferenceNumber == lineDto.RefNumber && a.UserId == UserId);

                    if (account == null)
                    {
                        var accountType = AccountClassification.TypeFromReferenceNumber(lineDto.RefNumber);

                        account = new ChartOfAccount
                        {
                            UserId = UserId,
                            ReferenceNumber = lineDto.RefNumber,
                            AccountName = lineDto.AccountName,
                            Type = accountType ?? "Other",
                            Role = "Default",
                            IsActive = true,
                        };

                        DbContext.ChartOfAccounts.Add(account);
                        accountsCreated++;
                    }

                    entryLines.Add(new JournalEntryLine
                    {
                        Account = account,
                        LineDescription = lineDto.Description,
                        Debit = lineDto.Debit ?? 0m,
                        Credit = lineDto.Credit ?? 0m,
                        LineOrder = entryLines.Count + 1
                    });
                }

                var prefix = txDto.JournalType == "Adjusting" ? "AJE" : "GJ";
                var seq = await NextSeqAsync(prefix);

                var entry = new JournalEntry
                {
                    UserId = UserId,
                    ReferenceNumber = $"{prefix}-{seq:D6}",
                    JournalType = txDto.JournalType,
                    EntryDate = txDto.Date,
                    Lines = entryLines,
                };

                DbContext.JournalEntries.Add(entry);
                transactionsImported++;
            }

            await DbContext.SaveChangesAsync();

            successMessage = $"Successfully imported {transactionsImported} journal entries with {accountsCreated} new COA accounts created.";
            await JS.InvokeVoidAsync("aumoModal.hide", "previewModal");
            parseResult = null;
            selectedFile = null;
        }
        catch (Exception ex)
        {
            errorMessage = $"Failed to save entries: {ex.Message}";
        }
        finally
        {
            isBusy = false;
        }
    }
}
