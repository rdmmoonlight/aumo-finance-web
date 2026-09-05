using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AumoFinance.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ToolsController : ControllerBase
{
    [HttpGet("DownloadJournalTemplate")]
    public IActionResult DownloadJournalTemplate()
    {
        using var workbook = new XLWorkbook();

        // --- Buat Sheet General Journal (GJ) ---
        var wsGj = workbook.Worksheets.Add("GJ");
        wsGj.Cell(1, 1).Value = "Date";
        wsGj.Cell(1, 2).Value = "Account Name";
        wsGj.Cell(1, 3).Value = "Description";
        wsGj.Cell(1, 4).Value = "Ref";
        wsGj.Cell(1, 5).Value = "Debit";
        wsGj.Cell(1, 6).Value = "Credit";
        wsGj.Row(1).Style.Font.Bold = true;

        // --- Buat Sheet Adjusting Journal (AJ) ---
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
}
