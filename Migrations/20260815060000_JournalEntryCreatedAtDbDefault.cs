using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AumoFinance.Migrations
{
    /// <inheritdoc />
    public partial class JournalEntryCreatedAtDbDefault : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Perintah SQL untuk menambahkan default now() ke kolom
            // JournalEntries.CreatedAt dijalankan manual lewat Neon SQL
            // Editor (lihat Migrations/manual-neon-run-journal-createdat-default.sql),
            // jadi Up() di sini dibiarkan kosong agar tidak error/duplikat
            // saat aplikasi start.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
