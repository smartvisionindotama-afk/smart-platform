# POS.e-Profit V1 — Gap Report M0–M3

| Field       | Value                                                        |
|-------------|--------------------------------------------------------------|
| Dokumen     | `docs/pos/pos-gap-report-v1.md`                              |
| Berdasarkan | `docs/pos/pos_roadmap_v1.md` (PRD V1 — Golden Rules + Part II–XX) |
| Tanggal     | 2026-08-10                                                    |
| Status      | ✅ Audit selesai — 5 CONFLICT disetujui PO (2026-08-10) — TODO V1 (T1–T12) DIIMPLEMENTASIKAN (M3-FIX v7) + **Retur & Koreksi (M3-FIX v11)**: engine `retur-penjualan` behavior-aware + `sumber=pos` + blokir void + dokumen `pos-retur-koreksi.md`; PRD V1.1 §7.8.1 + **M3-FIX v12–v13: enforcement konfigurasi Company** (kuota gudang/kasir + Single Lokasi block transfer, server+UI) di **POS & Inventory** + v14 (fix Edit Perusahaan Console) + v15 (pesan kuota ringkas) + **v16: T5 Hold/Resume DONE (approval PO)** + **v17: kuota kasir role-aware** — live https://pos.e-profit.id · full regression **846/846** (47 files) · sisa backlog butuh approval PO: **T13 Retur dari layar kasir** |

---

## 1. Metodologi

Audit dilakukan terhadap implementasi aktual M0–M3 di `apps/pos` (server + client) dan
`apps/console` (Master Platform), lalu dibandingkan dengan PRD `pos_roadmap_v1.md`
(Golden Rules 1–20 + PRD bab 4–20 yang baru dilengkapi).

Klasifikasi per requirement:

| Klasifikasi | Definisi |
|-------------|----------|
| **DONE**    | Sudah diimplementasi & memenuhi acceptance criteria — **WAJIB dipertahankan** |
| **PARTIAL** | Sebagian terpenuhi; sisanya gap kecil (extend additive) |
| **TODO**    | Belum ada — perlu diimplementasi (urutan roadmap) |
| **CONFLICT**| Perlu keputusan Product Owner sebelum dikerjakan |

> Aturan eksekusi (Part XIX): JANGAN membuat ulang fitur yang sudah ada; JANGAN rewrite
> hanya karena requirement disebut lagi di PRD; CONFLICT tidak boleh diperbaiki tanpa approval.

---

## 2. Gap Report per Area

### 2.1 Platform & Master Platform Integration (M2) — DONE ✅

| Requirement PRD | Status | Bukti / Catatan |
|-----------------|--------|-----------------|
| pos.e-profit.id berjalan | ✅ DONE | Live SSL, PM2 pos-api :3003 |
| master.e-profit.id source of truth Company | ✅ DONE | `Company` di Console; POS tanpa menu buat company |
| Company ID konsisten | ✅ DONE | `x-company-code` + Company.apps |
| Product activation (`apps`: inventory, pos) | ✅ DONE | Gate login user POS (403 + audit) + impersonation |
| Business Type terbaca | ✅ DONE | `businessType` Console → `companyConfig` POS |
| Single/Multi Location | ✅ DONE | `lokasiMode` → `filterMenusByLokasi` (single: sembunyi Transfer) |
| License config | ✅ DONE | `lisensiStatus`/`lisensiExpiresAt` tersimpan & terbaca |
| Jumlah kasir / gudang | ✅ DONE | `jumlahKasir`, `jumlahGudang` — **M3-FIX v12–v13: enforcement 3 lapis di POS & Inventory** — server `company-limits.js` (POST warehouse/users + PUT users ditolak saat kuota penuh, transfer 403 single lokasi), UI `createGuard`/`roleGuard` (SettingsUserModule additive — **v17: kuota kasir role-aware**, hanya role `kasir` yang diblokir, admin/operator tetap bisa; banner info tanpa menonaktifkan tombol), banner konfigurasi di main.js (kedua app) |
| Login As multi-aplikasi (Console) | ✅ DONE | Picker Inventory/POS (PRE-M5 round 6) |

### 2.2 POS Core — Kasir Screen (M3) — PARTIAL 🔶

| Requirement PRD | Status | Bukti / Catatan |
|-----------------|--------|-----------------|
| Layar kasir 3 kolom (kategori·produk·bill) | ✅ DONE | `apps/pos/src/pages/pos` |
| Search nama & SKU (kode) | ✅ DONE | `getFilteredProduk` |
| Search barcode | ❌ TODO | Belum ada field barcode di Barang |
| Filter kategori (panel) | ✅ DONE | Panel kiri kategori |
| Grid item + quick add (klik) | ✅ DONE | Kart produk + tombol + |
| Barcode scanner | ❌ TODO | Komponen `@smart/ui` BarcodeScanner tersedia (reuse) |
| Recent / favorite item | ⬜ OPSIONAL | PRD: "jika diperlukan" → backlog |
| Cart: tambah/ubah qty/hapus | ✅ DONE | Stepper qty + hapus |
| Diskon item | ❌ TODO | Engine sudah terima `item.diskon` — UI belum |
| Diskon transaksi | ❌ TODO | Engine sudah terima `diskon` header — UI belum |
| Catatan transaksi | ❌ TODO | Engine sudah terima `catatan` — UI belum |
| Harga retail | ✅ DONE | `harga_jual` |
| Multi harga / harga khusus | ⬜ BACKLOG | PRD §7.4 — lihat CONFLICT C2 |
| Pajak toggle 10% | ✅ DONE | Toggle di bill (default on) |
| New transaction | ✅ DONE | Keranjang baru setelah checkout |
| Hold / Resume transaction | ❌ TODO | Belum ada (status `held` + list) |
| Void transaction (permission) | ❌ TODO | Engine: DELETE + reversal stok ada; **UI kasir + permission belum** |
| Cancel transaction | ✅ DONE (partial) | Hapus keranjang; DELETE SO status order |

### 2.3 Payment (Part VI §7.6 / Part XI)

| Requirement | Status | Catatan |
|-------------|--------|---------|
| Cash | ✅ DONE | `bayar` + `kembalian` |
| Transfer / QRIS / Card | ❌ TODO | Perlu `metode_bayar` (enum, additive) — extensible |
| Payment method di struk | ❌ TODO | Menyusul `metode_bayar` |
| Receipt: nomor/tanggal/kasir/item/qty/harga/pajak/total/bayar/kembalian | ✅ DONE | Struk printable |
| Receipt: diskon + payment method | ❌ TODO | Menyusul diskon + metode_bayar |

### 2.4 Transaction Engine & Mixed Behavior — DONE/PARTIAL ✅🔶

| Requirement | Status | Catatan |
|-------------|--------|---------|
| Trading: stok berkurang saat sale | ✅ DONE | `splitPosItemsByBehavior` + decrement deterministik by `_id` |
| Service: tidak mengurangi stok | ✅ DONE | |
| Mixed transaksi (trading+service) | ✅ DONE | Teruji unit + live (KWT-…, Aquaviva 200→199) |
| Recipe foundation (interface, NO-OP V1) | ❌ TODO | Perlu `behavior: recipe` + hook — lihat CONFLICT C1 |
| Manufactured / Digital enum placeholder | ❌ TODO | Enum extensible tanpa engine |
| Kasir tidak tahu perbedaan behavior | ✅ DONE | |

### 2.5 Master Item — PARTIAL 🔶

| Field PRD | Status |
|-----------|--------|
| Item Code, Name, Category, Unit, Purchase/Selling Price, Min Stock, Behavior, Active | ✅ DONE |
| Barcode | ❌ TODO |
| Multi Price / Tax / Supplier | ⬜ BACKLOG (additive nanti) |

> Tidak ada duplicate master item — POS baca `Barang` (SSOT) ✅

### 2.6 Cashier & Shift (Part XI) — TODO ❌

| Requirement | Status |
|-------------|--------|
| Shift Opening (kas awal, kasir, waktu mulai) | ❌ TODO |
| During shift (transaksi, payment, void, return) | ❌ TODO (void/return) |
| Shift Closing (expected, actual, difference) | ❌ TODO |
| Permission `pos.shift.*` | ❌ TODO |
| Model Shift | ❌ TODO (baru — tidak ada di Inventory) |

### 2.7 Dashboard (Part V) — PARTIAL 🔶

| Requirement | Status |
|-------------|--------|
| Owner/Admin: omzet hari ini, jumlah transaksi, terlaris, stok menipis, metode bayar, per periode, ringkasan kasir/shift | ❌ TODO (dashboard saat ini = reuse InventoryDashboard) |
| Kasir: shift aktif, total transaksi/penjualan, shortcut kasir, status kas, riwayat hari ini | ❌ TODO |

### 2.8 Reporting (Part XIII) — PARTIAL 🔶

| Requirement | Status |
|-------------|--------|
| Sales today / by period | ✅ DONE (`/api/laporan/sales` + date range) |
| Sales by item / category / cashier | ❌ TODO |
| Payment breakdown (cash/transfer/qris) | ❌ TODO (butuh `metode_bayar`) |
| Inventory: stock, low stock, movement | ✅ DONE (`/stock`, `mutation`) |
| Cashier/shift report | ❌ TODO (butuh Shift) |
| Laba-rugi, piutang, supplier, customer | ✅ DONE (bonus, reuse existing) |

### 2.9 User & Permission (Part XII) — PARTIAL 🔶

| Requirement | Status |
|-------------|--------|
| Role Admin (akses penuh) | ✅ DONE |
| Role Kasir (dibatasi) | ✅ DONE (dashboard + kasir + barang.read) |
| Kasir TIDAK bisa ubah master/inventory/company config/user/permission | ✅ DONE (permission gating) |
| Kasir akses Customer, Riwayat transaksi, Shift (PRD §14.2) | ❌ TODO (lihat CONFLICT C3) |

### 2.10 Return (Part VI §7.8) — DONE ✅ (engine) / BACKLOG (UI kasir)

| Requirement | Status |
|-------------|--------|
| Reuse `retur-penjualan` engine | ✅ DONE (route CRUD + stok, M3-FIX v11) |
| Stok behavior-aware (hanya trading yang bertambah saat `returned`) | ✅ DONE (`returStockItems` pure helper + unit test) |
| Dukungan transaksi asal POS (KWT, `sumber: "pos"`) | ✅ DONE (model field `sumber` + auto-detect dari transaksi asal) |
| Blokir retur transaksi void/order + validasi qty ≤ qty asal | ✅ DONE (route `validateItemsAgainstSo`, 400) |
| Hapus retur `returned` → reversal stok behavior-aware | ✅ DONE (DELETE) |
| Definisi Void vs Retur vs Koreksi terdokumentasi | ✅ DONE (PRD §7.8.1 + `pos-retur-koreksi.md`) |
| Workflow retur dari layar kasir | ⬜ BACKLOG (T13, opsional V1 — engine siap) |

### 2.11 UI/UX (Part XVII) — DONE/PARTIAL ✅🔶

Cepat, sederhana, sedikit klik, responsive, dark mode, keyboard friendly (Enter=checkout):
✅ DONE. Barcode friendly: ❌ TODO (menyusul scanner).

---

## 3. Daftar TODO V1 (urutan roadmap / engine-first R16)

| # | TODO | Area | Prioritas | Catatan |
|---|------|------|-----------|---------|
| T1 | Field `barcode` di Barang + search barcode + scanner (reuse `@smart/ui` BarcodeScanner) | POS Core | P1 | Additive |
| T2 | Payment methods: `metode_bayar` (cash/transfer/qris/card) — model + route + UI + struk + report | Payment | P1 | Additive, extensible |
| T3 | Diskon item + diskon transaksi + catatan transaksi di UI kasir | POS Core | P1 | Engine sudah siap |
| T4 | Void transaction (permission `pos.transaction.void` + UI + audit) | POS Core | P1 | Engine DELETE ada |
| T5 | Hold/Resume transaction (`status: held`) | POS Core | P2 | |
| T6 | Shift model + routes (open/close) + permission `pos.shift.*` | Shift | P1 | Entity baru |
| T7 | Dashboard Owner/Admin (omzet, terlaris, stok menipis, metode bayar, ringkasan kasir/shift) | Dashboard | P1 | |
| T8 | Dashboard Kasir (shift aktif, total, shortcut, status kas, riwayat) | Dashboard | P1 | |
| T9 | Reporting: sales by item/category/cashier + payment report + cashier/shift report | Reporting | P1 | |
| T10 | Recipe foundation: `behavior: recipe` + hook NO-OP (V1) | Behavior | P2 | |
| T11 | Enum placeholder `manufactured`/`digital` | Behavior | P2 | |
| T12 | Role Kasir: + Customer, Riwayat transaksi, Shift (per PRD §14.2) | Security | P2 | Tunggu CONFLICT C3 |
| T13 | Workflow retur dari layar kasir (reuse engine) | POS Core | P3 | Opsional V1 |

---

## 4. Daftar CONFLICT / Decision — BUTUH APPROVAL PRODUCT OWNER

| # | Conflict / Decision | Opsi | Rekomendasi |
|---|---------------------|------|-------------|
| C1 | **Recipe behavior V1**: item `behavior: recipe` yang dijual — apa dampak stoknya? | (a) Perlakukan sebagai trading; (b) Blokir penjualan recipe; (c) Jual tanpa dampak stok (seperti service) | **✅ DISETUJUI (c)** — item recipe dijual TANPA mengurangi stok di V1; foundation hook disiapkan untuk V2 (2026-08-10) |
| C2 | **Multi price / harga khusus**: masuk V1 atau backlog? | (a) Backlog; (b) Minimal 1 tier harga khusus per item | **✅ DISETUJUI (b)** — implementasi minimal V1: field `harga_khusus` per item (2026-08-10) |
| C3 | **Role Kasir**: PRD §14.2 memberi kasir akses Customer, Riwayat transaksi, Shift | (a) Sesuai PRD; (b) Ketat | **✅ DISETUJUI (a)** — kasir mendapat Customer, Riwayat Transaksi, Shift (2026-08-10) |
| C4 | **Void**: siapa yang boleh void? | (a) Hanya Admin/Owner; (b) Kasir boleh void sendiri | **✅ DISETUJUI (a)** — permission baru `pos.transaction.void` hanya di role Admin/Owner (2026-08-10) |
| C5 | **Pajak**: persentase & skema | (a) Toggle 10%; (b) Per item; — + keputusan persentase | **✅ DISETUJUI** — toggle per transaksi **11%** (keputusan PO, 2026-08-10); pajak per item = backlog |

> **Semua CONFLICT telah disetujui Product Owner (2026-08-10). Implementasi TODO boleh dimulai.**

---

## 5. Rencana Implementasi M3–M5 (setelah approval)

```
M3-FIX v7 (P1, engine-first):
  T1 barcode → T2 metode_bayar → T3 diskon/catatan → T4 void → T6 shift → T7/T8 dashboard → T9 report

M3-FIX v8 (P2):
  T5 hold/resume → T10 recipe foundation → T11 enum → T12 role kasir

M4 (Payment & Reporting MVP):
  Integrasi metode_bayar ke laporan + struk; shift closing → laporan kasir

M5 (Hardening & Production Ready):
  Test penuh → lint → build → deploy → audit (Part XX)
```

**Engine-first (R16):** setiap TODO: Business Rules (sudah di PRD) → Engine/Model → API → Workflow → UI → UX.

---

## 6. Status Test (baseline + pasca implementasi TODO V1)

| Cek | Hasil |
|-----|-------|
| Unit test full suite | **841/841** ✅ (47 files — pos-transaction 13, company-limits 12×2, company-config 14×2, companies-config 16, kasir-page 3) |
| Lint | **0 error** (baseline pre-existing di packages/smart-ui tetap) |
| Build | pos ✓ · inventory ✓ · console ✓ |
| Live | pos.e-profit.id 200 · inv.e-profit.id 200 · master.e-profit.id 200 · bundle `index-DGRIHjDh.js` (pos, sinkron dist) |
| Deploy | pos-api PM2 :3003 · inventory-api · console-api — semua online, health 200 |

## 7. Progress TODO V1

| # | TODO | Status |
|---|------|--------|
| T1 | barcode (field+search+scanner) | ✅ DONE (M3-FIX v7) |
| T2 | metode_bayar (cash/transfer/qris/card) + struk + report | ✅ DONE |
| T3 | diskon transaksi + catatan transaksi | ✅ DONE |
| T4 | void (permission pos.transaction.void + reversal + UI injectable) | ✅ DONE |
| T5 | hold/resume transaction | ✅ DONE (M3-FIX v16, approval PO) — status `held` + `POST /:id/hold` & `/:id/resume` (permission `pos.transaction.hold`) + filter `?status=held` + tombol/badge/modal di layar kasir; stok tidak berubah; 5 unit test `checkHoldResumeTransition` |
| T6 | Shift (model + routes + UI + widget kasir) | ✅ DONE |
| T7/T8 | Dashboard owner & kasir | ✅ DONE |
| T9 | sales-breakdown by item/category/cashier/payment | ✅ DONE |
| T10/T11 | recipe foundation + enum manufactured/digital | ✅ DONE (foundation NO-OP per C1) |
| T12 | Role kasir + Customer/Riwayat/Shift | ✅ DONE (seed per C3) |
| T13 | retur dari layar kasir | ⬜ BACKLOG (P3 opsional) — **engine behavior-aware + sumber=pos + blokir void sudah DONE (M3-FIX v11)**; sisa UI tombol Retur di kasir (butuh approval PO) |

## 8. Commit / Branch

| Item | Value |
|------|-------|
| Branch | `epic-002-inventory` |
| Status | `apps/pos/` + `docs/pos/` untracked (belum di-commit) — rekomendasi: `git add apps/pos docs/pos && git commit` setelah approval |

---

## 7. Commit / Branch

| Item | Value |
|------|-------|
| Branch | `epic-002-inventory` |
| Status | `apps/pos/` untracked (belum di-commit) + perubahan Console (login-as, dsb.) |
| Rekomendasi | Setelah approval & implementasi TODO, commit ke branch feat: `git add apps/pos docs/pos && git commit` |
