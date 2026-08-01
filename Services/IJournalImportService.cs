using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;
using YourProject.Models.DTOs;

namespace YourProject.Services
{
    public interface IJournalImportService
    {
        Task<JournalImportResultDto> ReadJournalExcelAsync(IFormFile file);
    }
}
