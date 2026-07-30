-- 1. Akun sistem "Unclassified" (idempoten, aman dijalankan berkali-kali)
INSERT INTO "ChartOfAccounts" ("ReferenceNumber", "AccountName", "Type", "Role", "IsActive")
SELECT 499, 'Unclassified Income', 'OperatingIncome', 'UnclassifiedIncome', TRUE
WHERE NOT EXISTS (SELECT 1 FROM "ChartOfAccounts" WHERE "ReferenceNumber" = 499);

INSERT INTO "ChartOfAccounts" ("ReferenceNumber", "AccountName", "Type", "Role", "IsActive")
SELECT 599, 'Unclassified Expense', 'OperatingExpenses', 'UnclassifiedExpense', TRUE
WHERE NOT EXISTS (SELECT 1 FROM "ChartOfAccounts" WHERE "ReferenceNumber" = 599);

-- 2. Kolom baru di JournalEntries
ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "NeedsClassification" boolean NOT NULL DEFAULT FALSE;
ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "Source" text NULL;
ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "MobileNote" text NULL;

-- 3. Catat migrasi di riwayat EF Core supaya "dotnet ef database update"
--    berikutnya tidak mencoba menjalankan ulang perubahan yang sama.
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260730020000_AddUnclassifiedAccounts', '8.0.10'
WHERE NOT EXISTS (SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260730020000_AddUnclassifiedAccounts');

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260730020100_AddMobileClassificationFields', '8.0.10'
WHERE NOT EXISTS (SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260730020100_AddMobileClassificationFields');
