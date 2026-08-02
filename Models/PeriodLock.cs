namespace AumoFinance.Models
{
    // Util untuk memeriksa apakah sebuah tanggal transaksi berada di dalam
    // periode yang sudah ditutup (Closed). Dipakai di General Journal,
    // Adjusting Journal, dan Journal Entry supaya definisi "terkunci"
    // konsisten di semua tempat — begitu periode ditutup, transaksi pada
    // rentang tanggalnya tidak lagi ditampilkan/diubah di halaman-halaman
    // tersebut, dan hanya bisa dilihat kembali lewat halaman Period Details.
    public static class PeriodLock
    {
        public static bool IsDateLocked(DateTime date, IEnumerable<Period> closedPeriods)
        {
            return closedPeriods.Any(p => date >= p.StartDate && date <= p.EndDate);
        }
    }
}
