using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AumoFinance.Migrations
{
    /// <inheritdoc />
    public partial class AddTransactionCounters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Tabel TransactionCounters ditambahkan manual lewat Neon SQL
            // Editor (lihat Migrations/manual-neon-run-transaction-counters.sql),
            // jadi Up() di sini dibiarkan kosong agar tidak error/duplikat
            // saat aplikasi start.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
