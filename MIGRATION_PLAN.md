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

- [ ] **Fase 1 — Risiko Rendah**
  - Chart of Accounts
  - Periods

- [ ] **Fase 2 — Dashboard**
  - KPI Cards, Charts Section, Recent Data Tables

- [ ] **Fase 3 — Transaksi**
  - General Journal
  - Adjusting Journal
  - Journal Entry (Create/Edit)

- [ ] **Fase 4 — Laporan Keuangan**
  - Trial Balance, Adjusted Trial Balance, Post-Closing Trial Balance
  - Cash Flow Statement
  - Income Statement, Statement of Financial Position
  - Worksheet, Closing Journal, General Ledger, Retained Earnings

- [ ] **Fase 5 — Pendukung**
  - Document, Mobile Classification, Tools (Import Journal), AI Assistant

- [ ] **Fase 6 — Auth & Security (terakhir)**
  - Auth (Login/Register/Password/Email)
  - Guardian (Sessions, Devices, Recovery Codes, Activity)

## Catatan
- Build lokal (`dotnet build`) wajib dijalankan setelah tiap fase — proses
  konversi ini dikerjakan tanpa akses ke .NET SDK/NuGet, jadi verifikasi
  kompilasi dilakukan manual oleh Anda.
- Controller lama TIDAK dihapus sampai seluruh fase yang bergantung padanya
  selesai dikonversi dan diverifikasi.
