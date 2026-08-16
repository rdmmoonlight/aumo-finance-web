-- Jalankan manual lewat Neon SQL Editor.
-- Tujuan: kolom baru JournalEntries.UpdatedAt untuk mencatat kapan
-- terakhir sebuah entry diedit user (timestamp ke-3, selain EntryDate
-- manual dan CreatedAt otomatis saat entry pertama kali dibuat).
-- Nullable — tetap NULL selama entry belum pernah diedit.

ALTER TABLE "JournalEntries"
ADD COLUMN "UpdatedAt" timestamp with time zone NULL;
