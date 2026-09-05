-- Jalankan di Neon SQL Editor SETELAH manual-neon-run-user-isolation.sql.
-- Melengkapi full per-user isolation: EconomicDocuments (Document
-- Repository) juga menjadi milik satu user, terpisah dari user lain.
--
-- Data yang SUDAH ADA akan di-assign ke user PERTAMA yang terdaftar
-- (AspNetUsers, urutan Id) — sama seperti migrasi sebelumnya. Ganti
-- subquery di bawah kalau ingin data lama menjadi milik user tertentu.

DO $$
DECLARE
    default_user_id uuid;
BEGIN
    SELECT "Id" INTO default_user_id FROM "AspNetUsers" ORDER BY "Id" LIMIT 1;

    IF default_user_id IS NULL THEN
        RAISE EXCEPTION 'No user found in AspNetUsers. Register at least one account before running this migration.';
    END IF;

    ALTER TABLE "EconomicDocuments" ADD COLUMN IF NOT EXISTS "UserId" uuid;
    UPDATE "EconomicDocuments" SET "UserId" = default_user_id WHERE "UserId" IS NULL;
    ALTER TABLE "EconomicDocuments" ALTER COLUMN "UserId" SET NOT NULL;
END $$;

CREATE INDEX IF NOT EXISTS "IX_EconomicDocuments_UserId" ON "EconomicDocuments" ("UserId");
