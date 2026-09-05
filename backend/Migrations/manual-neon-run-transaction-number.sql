-- Jalankan di Neon SQL Editor.
-- Rename kolom JournalEntries.ReferenceNumber -> TransactionNumber.
-- Ini HANYA untuk nomor transaksi jurnal (GJ-xxxxxx / AJE-xxxxxx).
-- TIDAK menyentuh ChartOfAccounts.ReferenceNumber (kode akun) atau
-- EconomicDocuments.ReferenceNumber (field terpisah) — keduanya tetap
-- bernama ReferenceNumber seperti semula.

-- 1. Rename kolom (RENAME COLUMN mempertahankan data yang sudah ada).
ALTER TABLE "JournalEntries" RENAME COLUMN "ReferenceNumber" TO "TransactionNumber";

-- 2. Rename index unik agar namanya konsisten dengan kolom baru.
--    (Postgres tidak otomatis mengganti nama index saat kolom di-rename.)
ALTER INDEX "IX_JournalEntries_UserId_ReferenceNumber"
    RENAME TO "IX_JournalEntries_UserId_TransactionNumber";
