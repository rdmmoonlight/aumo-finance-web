-- Jalankan manual lewat Neon SQL Editor.
-- Tujuan: JournalEntries.CreatedAt diisi otomatis oleh database (default
-- now(), lengkap tanggal + jam) saat baris di-insert, bukan lagi oleh
-- aplikasi (device-local timestamp / field dari client).

-- 1. Rapikan baris lama yang kebetulan tersimpan dengan CreatedAt kosong
--    (0001-01-01), jika ada — pakai EntryDate-nya sebagai gantinya.
UPDATE "JournalEntries"
SET "CreatedAt" = "EntryDate"
WHERE "CreatedAt" < TIMESTAMPTZ '1900-01-01';

-- 2. Pasang default now() pada kolom CreatedAt.
ALTER TABLE "JournalEntries"
ALTER COLUMN "CreatedAt" SET DEFAULT now();
