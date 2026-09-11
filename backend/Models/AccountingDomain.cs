using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text.RegularExpressions;
using System;

namespace AumoBackend.Models;

// Aturan klasifikasi akun akuntansi dipusatkan di satu tempat, supaya
// Chart of Accounts, Journal Entry, General Journal, General Ledger, dan
// General Ledger (Temporary Accounts) memakai definisi yang sama persis.
public static class AccountClassification
{
    private static readonly HashSet<string> PermanentTypes = new()
        {
            "Assets", "Liabilities", "Equity"
        };

    private static readonly HashSet<string> TemporaryTypes = new()
        {
            "OperatingIncome", "OperatingExpenses", "OtherIncome", "OtherExpenses"
        };

    private static readonly HashSet<string> NormalDebitTypes = new()
        {
            "Assets", "OperatingExpenses", "OtherExpenses"
        };

    // Akun riil/permanen (Neraca): saldo dibawa terus antar periode.
    public static bool IsPermanent(string type) => PermanentTypes.Contains(type);

    // Akun nominal/sementara (Laba Rugi): ditutup ke Equity/Retained
    // Earnings pada akhir periode.
    public static bool IsTemporary(string type) => TemporaryTypes.Contains(type);

    public static bool NormalBalanceIsDebit(string type) => NormalDebitTypes.Contains(type);

    public static int ValidRangeStart(string type) => type switch
    {
        "Assets" => 100,
        "Liabilities" => 200,
        "Equity" => 300,
        "OperatingIncome" => 400,
        "OperatingExpenses" => 500,
        "OtherIncome" => 600,
        "OtherExpenses" => 800,
        _ => 0
    };

    public static int ValidRangeEnd(string type) => type switch
    {
        "Assets" => 199,
        "Liabilities" => 299,
        "Equity" => 399,
        "OperatingIncome" => 499,
        "OperatingExpenses" => 599,
        "OtherIncome" => 799,
        "OtherExpenses" => 999,
        _ => 0
    };

    public static bool ValidateReferenceNumber(string type, int referenceNumber)
    {
        var start = ValidRangeStart(type);
        var end = ValidRangeEnd(type);
        return start != 0 && referenceNumber >= start && referenceNumber <= end;
    }

    // Kebalikan dari ValidRangeStart/End: dipakai saat auto-membuat akun
    // baru ke Chart of Accounts pada waktu import, supaya Type otomatis
    // mengikuti rentang nomor Ref yang diinput user (tidak perlu diminta
    // manual di template import).
    public static string? TypeFromReferenceNumber(int referenceNumber) => referenceNumber switch
    {
        >= 100 and <= 199 => "Assets",
        >= 200 and <= 299 => "Liabilities",
        >= 300 and <= 399 => "Equity",
        >= 400 and <= 499 => "OperatingIncome",
        >= 500 and <= 599 => "OperatingExpenses",
        >= 600 and <= 799 => "OtherIncome",
        >= 800 and <= 999 => "OtherExpenses",
        _ => null
    };
}

public class ChartOfAccount
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Reference number is required.")]
    public int ReferenceNumber { get; set; }

    // Pemilik akun ini — setiap user punya Chart of Accounts sendiri,
    // benar-benar terpisah dari user lain.
    public Guid UserId { get; set; }

    [Required(ErrorMessage = "Account name is required.")]
    [StringLength(100)]
    public string AccountName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Account type is required.")]
    public string Type { get; set; } = string.Empty;

    [Required(ErrorMessage = "System role is required.")]
    public string Role { get; set; } = string.Empty;

    // Tidak disimpan ke database. Saldo selalu dihitung ulang dari
    // JournalEntryLine (General Ledger), supaya Chart of Accounts tidak
    // pernah berbeda dengan Journal Entry / General Journal / Ledger.
    [NotMapped]
    public decimal Balance { get; set; }

    public bool IsActive { get; set; } = true;

    // Label siap-tampil, mis. "101 - Cash on Hand". Dipakai di dropdown
    // Journal Entry supaya nomor referensi COA otomatis muncul.
    [NotMapped]
    public string DisplayLabel => $"{ReferenceNumber} - {AccountName}";
}

public class JournalEntry
{
    public int Id { get; set; }

    // Pemilik jurnal ini — setiap user punya buku besar sendiri.
    public Guid UserId { get; set; }

    [Required]
    [StringLength(30)]
    public string TransactionNumber { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string JournalType { get; set; } = "General"; // "General" atau "Adjusting"

    [Required]
    public DateTime EntryDate { get; set; }

    // Waktu pencatatan — diisi otomatis berdasarkan jam lokal perangkat
    // pengguna saat entri diinput (bukan jam server saat tersimpan ke database).
    public DateTime CreatedAt { get; set; }

    // Waktu terakhir entri ini diedit — diisi otomatis berdasarkan jam lokal
    // perangkat pengguna saat edit disimpan. Null jika belum pernah diedit.
    public DateTime? UpdatedAt { get; set; }

    public List<JournalEntryLine> Lines { get; set; } = new();

    public decimal TotalDebit => Lines.Sum(l => l.Debit);
    public decimal TotalCredit => Lines.Sum(l => l.Credit);
}

public class JournalEntryLine
{
    public int Id { get; set; }

    [Required]
    public int JournalEntryId { get; set; }

    [ForeignKey(nameof(JournalEntryId))]
    public JournalEntry? JournalEntry { get; set; }

    // Referensi langsung ke Chart of Account. Nomor referensi COA
    // (ChartOfAccount.ReferenceNumber) diambil lewat relasi ini,
    // bukan disalin manual, sehingga Journal Entry, General Journal,
    // General Ledger, dan General Ledger (Temporary Accounts) selalu
    // konsisten dengan satu sumber data yang sama.
    [Required]
    public int AccountId { get; set; }

    [ForeignKey(nameof(AccountId))]
    public ChartOfAccount? Account { get; set; }

    [StringLength(250)]
    public string? LineDescription { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal Debit { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal Credit { get; set; }

    public int LineOrder { get; set; }
}

public class Period
{
    [Key]
    public int Id { get; set; }

    // Pemilik periode ini — setiap user punya siklus periodenya sendiri.
    public Guid UserId { get; set; }

    [Required]
    [StringLength(100)]
    public string PeriodName { get; set; } = string.Empty;

    [Required]
    public DateTime StartDate { get; set; }

    [Required]
    public DateTime EndDate { get; set; }

    public bool IsClosed { get; set; }

    // Menandakan periode ini sedang di-VIEW oleh user pemiliknya (dipilih
    // lewat ikon mata di halaman Periods). Maksimum satu baris TRUE per
    // UserId — dijaga oleh unique partial index (UserId) di database.
    // Seluruh aplikasi (Dashboard, General/Adjusting Journal, laporan)
    // mengikuti periode mana yang sedang IsSelected = true milik user itu.
    public bool IsSelected { get; set; }
}

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

// Counter atomik untuk penomoran transaksi (GJ/AJ). Satu baris per
// kombinasi user + jenis transaksi + periode (CounterKey = prefix +
// YYMM, contoh "GJ2608"). LastSequence dinaikkan lewat UPSERT atomik
// (INSERT ... ON CONFLICT DO UPDATE) di TransactionNumberService,
// bukan MAX(TransactionNumber)+1 — supaya aman terhadap dua user atau
// dua request yang membuat jurnal secara bersamaan.
public class TransactionCounter
{
    public int Id { get; set; }

    public Guid UserId { get; set; }

    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(10)]
    public string CounterKey { get; set; } = string.Empty;

    public int LastSequence { get; set; }
}

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
