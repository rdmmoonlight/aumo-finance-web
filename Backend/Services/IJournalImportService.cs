using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;
using AumoFinance.Models.DTOs;

namespace AumoFinance.Services
{
    public interface IJournalImportService
    {
        Task<JournalImportResultDto> ReadJournalExcelAsync(IFormFile file);
    }
}
