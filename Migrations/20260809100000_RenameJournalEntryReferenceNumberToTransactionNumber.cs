using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AumoFinance.Migrations
{
    public partial class RenameJournalEntryReferenceNumberToTransactionNumber : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Kolom JournalEntries.ReferenceNumber di-rename ke TransactionNumber
            // secara manual lewat Neon SQL Editor (lihat
            // Migrations/manual-neon-run-transaction-number.sql), jadi Up() di sini
            // dibiarkan kosong agar tidak error/duplikat saat aplikasi start.
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
