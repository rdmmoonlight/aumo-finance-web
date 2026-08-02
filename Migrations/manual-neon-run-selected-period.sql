-- Jalankan di Neon SQL Editor.
-- Menambahkan penanda "periode yang sedang di-view" (global, dipakai di
-- seluruh aplikasi: Dashboard, General Journal, Adjusting Journal, dst.)

-- 1. Kolom baru di Periods (default FALSE untuk semua baris yang sudah ada)
ALTER TABLE "Periods" ADD COLUMN IF NOT EXISTS "IsSelected" boolean NOT NULL DEFAULT FALSE;

-- 2. Pastikan hanya ada maksimum SATU periode yang IsSelected = TRUE
--    di waktu yang sama, di seluruh tabel.
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Periods_IsSelected_Unique"
ON "Periods" ("IsSelected")
WHERE "IsSelected" = TRUE;
