-- Melengkapi fitur Folder pada Document Repository.
-- Aman dijalankan ulang (idempotent) — memakai IF NOT EXISTS di setiap langkah.

CREATE TABLE IF NOT EXISTS "Folders" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "UserId" uuid NOT NULL,
    "Name" character varying(150) NOT NULL,
    "ParentFolderId" uuid NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "FK_Folders_Folders_ParentFolderId"
        FOREIGN KEY ("ParentFolderId") REFERENCES "Folders" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_Folders_UserId" ON "Folders" ("UserId");
CREATE INDEX IF NOT EXISTS "IX_Folders_ParentFolderId" ON "Folders" ("ParentFolderId");

ALTER TABLE "EconomicDocuments" ADD COLUMN IF NOT EXISTS "FolderId" uuid NULL;

CREATE INDEX IF NOT EXISTS "IX_EconomicDocuments_FolderId" ON "EconomicDocuments" ("FolderId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'FK_EconomicDocuments_Folders_FolderId'
    ) THEN
        ALTER TABLE "EconomicDocuments"
            ADD CONSTRAINT "FK_EconomicDocuments_Folders_FolderId"
            FOREIGN KEY ("FolderId") REFERENCES "Folders" ("Id") ON DELETE CASCADE;
    END IF;
END $$;

-- Catat migrasi di riwayat EF Core supaya "dotnet ef database update"
-- berikutnya tidak mencoba menjalankan ulang perubahan yang sama.
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260804090000_AddFolders', '8.0.10'
WHERE NOT EXISTS (SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260804090000_AddFolders');
