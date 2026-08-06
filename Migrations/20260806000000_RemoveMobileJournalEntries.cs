using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AumoFinance.Migrations
{
    public partial class RemoveMobileJournalEntries : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Karena tabel di PostgreSQL sudah di-drop/backup manual,
            // metode Up dibiarkan kosong agar tidak error saat aplikasi dijalankan.
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
