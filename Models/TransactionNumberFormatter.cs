using System.Text.RegularExpressions;

namespace AumoFinance.Models
{
    // Database menyimpan TransactionNumber tanpa separator (GJ26080001).
    // UI menampilkannya dengan separator agar lebih enak dibaca
    // (GJ-2608-0001). Format tersimpan tidak pernah diubah — ini murni
    // helper tampilan, dipanggil di halaman Razor saat merender nomor
    // transaksi ke user.
    public static class TransactionNumberFormatter
    {
        private static readonly Regex NewFormat = new(@"^([A-Z]+)(\d{4})(\d{4})$", RegexOptions.Compiled);

        public static string ToDisplay(string? raw)
        {
            if (string.IsNullOrEmpty(raw)) return raw ?? string.Empty;

            var match = NewFormat.Match(raw);
            if (!match.Success)
            {
                // Data lama (format pra-migrasi, mis. "GJ-000001") atau
                // bentuk tak dikenal: tampilkan apa adanya, jangan dipaksa.
                return raw;
            }

            return $"{match.Groups[1].Value}-{match.Groups[2].Value}-{match.Groups[3].Value}";
        }
    }
}
