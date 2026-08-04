# Migration Plan: MVC → Blazor Server (Incremental, Page-by-Page)

Strategi: MVC dan Blazor Server berjalan bersamaan. Setiap halaman dikonversi
satu per satu tanpa mematikan halaman lain. Pola konversi mengikuti contoh
yang sudah ada: `Components/MarketWidget.razor` ditanam ke View lewat
`<component type="typeof(X)" render-mode="ServerPrerendered" />`.

## Status Fase

- [x] **Fase 0 — Fondasi**
  - Blazor Server sudah terpasang (`AddServerSideBlazor`, `MapBlazorHub`,
    `blazor.server.js`, `<component>` tag helper). Tidak ada perubahan
    tambahan diperlukan.

- [x] **Fase 1 — Risiko Rendah**
  - Chart of Accounts
  - Periods

- [x] **Fase 2 — Dashboard**
  - KPI Cards, Charts Section, Recent Data Tables

- [x] **Fase 3 — Transaksi**
  - General Journal
  - Adjusting Journal
  - Journal Entry (Create/Edit)

- [x] **Fase 4 — Laporan Keuangan**
  - Trial Balance, Adjusted Trial Balance, Post-Closing Trial Balance
  - Cash Flow Statement
  - Income Statement, Statement of Financial Position
  - Worksheet, Closing Journal, General Ledger, Retained Earnings

- [x] **Fase 5 — Pendukung**
  - Document, Mobile Classification, Tools (Import Journal), AI Assistant

- [x] **Fase 6 — Auth & Security (terakhir)**
  - Guardian (Sessions, Active Sessions tab, Protection & Logs) — dikonversi ke Blazor.
  - Auth (Login/Logout/Register/ForgotPassword/ResetPassword/VerifyEmail/
    ResendVerification) — **SENGAJA TETAP MVC selamanya**, bukan belum
    sempat. Login & Logout menulis cookie auth langsung ke HTTP response
    (tidak aman dilakukan dari komponen Blazor ServerPrerendered). Sisanya
    (Register dkk.) teknis aman dikonversi tapi tetap perimeter keamanan
    anonim aplikasi — risikonya tidak sepadan tanpa kemampuan `dotnet build`
    di lingkungan pengerjaan ini untuk verifikasi kompilasi.

## Catatan
- Build lokal (`dotnet build`) wajib dijalankan setelah tiap fase — proses
  konversi ini dikerjakan tanpa akses ke .NET SDK/NuGet, jadi verifikasi
  kompilasi dilakukan manual oleh Anda.
- Controller lama TIDAK dihapus sampai seluruh fase yang bergantung padanya
  selesai dikonversi dan diverifikasi.
