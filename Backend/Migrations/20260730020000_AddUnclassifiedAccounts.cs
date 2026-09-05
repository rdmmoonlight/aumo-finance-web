using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AumoFinance.Migrations
{
    /// <inheritdoc />
    public partial class AddUnclassifiedAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Data-only migration: memastikan dua akun sistem "Unclassified"
            // tersedia untuk menampung transaksi mobile sebelum diklasifikasikan.
            // Idempoten: aman dijalankan berkali-kali / di database yang sudah
            // memiliki akun ini secara manual.
            migrationBuilder.Sql(@"
                INSERT INTO ""ChartOfAccounts"" (""ReferenceNumber"", ""AccountName"", ""Type"", ""Role"", ""IsActive"")
                SELECT 499, 'Unclassified Income', 'OperatingIncome', 'UnclassifiedIncome', TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM ""ChartOfAccounts"" WHERE ""ReferenceNumber"" = 499
                );
            ");

            migrationBuilder.Sql(@"
                INSERT INTO ""ChartOfAccounts"" (""ReferenceNumber"", ""AccountName"", ""Type"", ""Role"", ""IsActive"")
                SELECT 599, 'Unclassified Expense', 'OperatingExpenses', 'UnclassifiedExpense', TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM ""ChartOfAccounts"" WHERE ""ReferenceNumber"" = 599
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM ""ChartOfAccounts""
                WHERE ""Role"" IN ('UnclassifiedIncome', 'UnclassifiedExpense');
            ");
        }
    }
}
