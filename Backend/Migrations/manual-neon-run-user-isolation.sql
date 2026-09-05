-- Jalankan di Neon SQL Editor SETELAH manual-neon-run-selected-period.sql.
-- Full per-user isolation: ChartOfAccounts, Periods, dan JournalEntries
-- masing-masing menjadi milik satu user (UserId), benar-benar terpisah
-- antar user.
--
-- Data yang SUDAH ADA di database akan di-assign ke user PERTAMA yang
-- terdaftar (AspNetUsers, urutan Id). Kalau Anda ingin data lama menjadi
-- milik user tertentu, ganti subquery "SELECT ... LIMIT 1" di bawah
-- dengan: SELECT "Id" FROM "AspNetUsers" WHERE "Email" = 'email@anda.com'

DO $$
DECLARE
    default_user_id uuid;
BEGIN
    SELECT "Id" INTO default_user_id FROM "AspNetUsers" ORDER BY "Id" LIMIT 1;

    IF default_user_id IS NULL THEN
        RAISE EXCEPTION 'No user found in AspNetUsers. Register at least one account before running this migration.';
    END IF;

    -- 1. ChartOfAccounts
    ALTER TABLE "ChartOfAccounts" ADD COLUMN IF NOT EXISTS "UserId" uuid;
    UPDATE "ChartOfAccounts" SET "UserId" = default_user_id WHERE "UserId" IS NULL;
    ALTER TABLE "ChartOfAccounts" ALTER COLUMN "UserId" SET NOT NULL;

    -- 2. Periods
    ALTER TABLE "Periods" ADD COLUMN IF NOT EXISTS "UserId" uuid;
    UPDATE "Periods" SET "UserId" = default_user_id WHERE "UserId" IS NULL;
    ALTER TABLE "Periods" ALTER COLUMN "UserId" SET NOT NULL;

    -- 3. JournalEntries
    ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "UserId" uuid;
    UPDATE "JournalEntries" SET "UserId" = default_user_id WHERE "UserId" IS NULL;
    ALTER TABLE "JournalEntries" ALTER COLUMN "UserId" SET NOT NULL;
END $$;

-- 4. Ganti unique constraint lama (global) jadi per-user, supaya dua user
--    boleh sama-sama punya akun ber-Reference 101 / jurnal ber-nomor GJ-000001.
DROP INDEX IF EXISTS "IX_ChartOfAccounts_ReferenceNumber";
CREATE UNIQUE INDEX IF NOT EXISTS "IX_ChartOfAccounts_UserId_ReferenceNumber"
ON "ChartOfAccounts" ("UserId", "ReferenceNumber");

DROP INDEX IF EXISTS "IX_JournalEntries_ReferenceNumber";
CREATE UNIQUE INDEX IF NOT EXISTS "IX_JournalEntries_UserId_ReferenceNumber"
ON "JournalEntries" ("UserId", "ReferenceNumber");

-- 5. Perbaiki unique index IsSelected: sebelumnya global (maksimum 1 periode
--    ter-pilih di SELURUH tabel), sekarang per-user (maksimum 1 periode
--    ter-pilih PER USER).
DROP INDEX IF EXISTS "IX_Periods_IsSelected_Unique";
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Periods_IsSelected_Unique"
ON "Periods" ("UserId")
WHERE "IsSelected" = TRUE;

-- 6. Index biasa untuk performa query per-user
CREATE INDEX IF NOT EXISTS "IX_ChartOfAccounts_UserId" ON "ChartOfAccounts" ("UserId");
CREATE INDEX IF NOT EXISTS "IX_Periods_UserId" ON "Periods" ("UserId");
CREATE INDEX IF NOT EXISTS "IX_JournalEntries_UserId" ON "JournalEntries" ("UserId");
