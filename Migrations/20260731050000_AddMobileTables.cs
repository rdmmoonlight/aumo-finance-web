using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AumoFinance.Migrations
{
    /// <inheritdoc />
    public partial class AddMobileTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MobileJournalEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EntryDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Mode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Note = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    VerifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    VerifiedJournalEntryId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MobileJournalEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MobileJournalEntries_JournalEntries_VerifiedJournalEntryId",
                        column: x => x.VerifiedJournalEntryId,
                        principalTable: "JournalEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "MobileJournalEntryLines",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MobileJournalEntryId = table.Column<int>(type: "integer", nullable: false),
                    AccountId = table.Column<int>(type: "integer", nullable: false),
                    LineDescription = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    Debit = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Credit = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LineOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MobileJournalEntryLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MobileJournalEntryLines_ChartOfAccounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "ChartOfAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MobileJournalEntryLines_MobileJournalEntries_MobileJournalEntryId",
                        column: x => x.MobileJournalEntryId,
                        principalTable: "MobileJournalEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MobileJournalEntries_Status",
                table: "MobileJournalEntries",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_MobileJournalEntries_VerifiedJournalEntryId",
                table: "MobileJournalEntries",
                column: "VerifiedJournalEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_MobileJournalEntryLines_AccountId",
                table: "MobileJournalEntryLines",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_MobileJournalEntryLines_MobileJournalEntryId",
                table: "MobileJournalEntryLines",
                column: "MobileJournalEntryId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MobileJournalEntryLines");

            migrationBuilder.DropTable(
                name: "MobileJournalEntries");
        }
    }
}
