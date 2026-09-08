using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace AumoBackend.Services
{
    public interface ICloudStorageService
    {
        Task<(string PublicId, string Url, long FileSize)> UploadFileAsync(IFormFile file, string folderName = "documents");
        Task<bool> DeleteFileAsync(string publicId);
    }
}
