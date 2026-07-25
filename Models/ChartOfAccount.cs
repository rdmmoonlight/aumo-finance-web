using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AurumFinance.Models
{
    public class ChartOfAccount
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Reference number is required.")]
        public int ReferenceNumber { get; set; }

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
}