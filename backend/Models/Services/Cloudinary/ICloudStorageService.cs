using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace AumoFinance.Services
{
    public interface ICloudStorageService
    {
        Task<(string PublicId, string Url, long FileSize)> UploadFileAsync(IFormFile file, string folderName = "documents");
        Task<bool> DeleteFileAsync(string publicId);
    }
}
