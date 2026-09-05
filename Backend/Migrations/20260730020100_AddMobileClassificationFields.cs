using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AumoFinance.Migrations
{
    /// <inheritdoc />
    public partial class AddMobileClassificationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "NeedsClassification",
                table: "JournalEntries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "JournalEntries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MobileNote",
                table: "JournalEntries",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NeedsClassification",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "MobileNote",
                table: "JournalEntries");
        }
    }
}
