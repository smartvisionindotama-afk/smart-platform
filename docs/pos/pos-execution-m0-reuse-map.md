# POS.e-Profit — M0 Reuse Map (Baseline & Peta Reuse vs Rewrite)

| Field       | Value                                                        |
|-------------|--------------------------------------------------------------|
| Dokumen     | `docs/pos/pos-execution-m0-reuse-map.md`                     |
| Milestone   | M0 — Analisis & Baseline (Task M0-1, M0-2)                   |
| Tanggal     | 2026-08-09                                                   |
| Status      | ✅ M0-1 & M0-2 selesai · ⬜ M0-3 menunggu PO                  |

---

## 1. Hasil Audit Baseline (M0-1)

Audit dilakukan **sebelum** kloning, pada kondisi repo terakhir:

| Cek | Hasil | Catatan |
|-----|-------|---------|
| `npm test` (vitest) | ✅ **762/762 pass** (40 test files) | Baseline hijau |
| `npm run lint` (root) | ⚠️ **20 errors / 311 warnings** | Error pre-existing di `packages/smart-ui` (login `google`/`FileReader` no-undef) — BUKAN dari perubahan M0/M1; apps/inventory tidak ikut ter-pindai karena gitlink |
| `npm run lint --workspace=pos` | ✅ **0 errors** | Setelah perbaikan `window.confirm` |
| Build `apps/inventory` | ✅ 0.97s | — |
| Build `apps/console` | ✅ 1.31s | — |
| Build `apps/pos` | ✅ 1.14s | App baru |

**Temuan penting baseline:**

1. `apps/inventory` adalah **nested git repo** (gitlink `160000`) — file-nya tidak ikut dipindai root lint/test suite secara langsung. `apps/pos` dibuat sebagai **bagian root repo** (pola `apps/console`), sehingga seluruh file-nya ikut ter-verifikasi lint & test — ini keunggulan (kualitas terjaga) sekaligus kewajiban (harus lint-clean).
2. **Satu database** untuk seluruh platform: `MONGO_URI` default sama (`mongodb://127.0.0.1:27017/smart_inventory`) di Inventory & Console (Golden Rule 7). POS memakai DB yang sama.
3. **Konvensi dependency server**: tiap app memiliki `server/package.json` + `node_modules` lokal (Inventory & Console). POS mengikuti pola yang sama.
4. **Konvensi workspace**: `@smart/ui/src/workspaces/` berisi workspace statis (`default`, `corporate`, `warehouse`) yang dipilih via `Institution.current().workspace`. POS menambah workspace **`pos`** (additive).
5. Registry aplikasi Console sudah mengenali **POS** (`apps/console/server/data/platform-app-logo-pos.json` + aplikasi ter-seed) — slug `pos` tersedia untuk logo & aktivasi.

---

## 2. Peta Reuse vs Rewrite (M0-2)

Berbasis Golden Rule 2 (Reuse Before Rewrite) & 3 (Do Not Break Inventory Engine).
Keputusan untuk **POS Core V1** (M3) — area yang ditandai `[USULAN]` menunggu PO (M0-3).

### 2.1 Reuse (tanpa perubahan) — engine yang diwariskan ke POS

| Modul | Lokasi sumber | Keputusan POS |
|-------|---------------|---------------|
| Authentication & Authorization | `@smart/security`, routes `auth/users/roles/permissions`, middleware M3 | **Reuse** — server POS menyalin route, memakai framework yang sama (One Authentication, Rule 6) |
| Database layer | `@smart/data` (BaseRepository, auto company-scoping), `server/db.js` | **Reuse** — DB & struktur sama (Rule 7) |
| Master Data | models/routes `barang`, `kategori`, `satuan`, `warehouse`, `rak`, `supplier`, `customer` + `@smart/inventory-ui` pages | **Reuse** — POS butuh barang, kategori, satuan untuk kasir |
| Inventory Engine | models/routes `barang-gudang`, `stock-opname`, `transfer`, `inventory-monitoring` | **Reuse** — tidak diubah (Rule 3) |
| Purchasing Engine | models/routes `pembelian`, `retur-pembelian` | **Reuse** — POS (toko) tetap butuh pembelian |
| Sales Engine | models/routes `penjualan`, `sales`, `retur-penjualan` | **Reuse** — basis Transaction Engine POS |
| Reporting | `laporan.js` + `@smart/inventory-ui` report module | **Reuse** — M4 menambah laporan kasir |
| Framework SDK | `@smart/core`, `@smart/ui`, `@smart/api`, `@smart/data`, `@smart/security`, `@smart/config` | **Reuse** — tanpa perubahan |
| Domain UI | `@smart/inventory-ui` (dashboard, barang, laporan, dst.) | **Reuse** — thin wrapper di `apps/pos/src/pages/*` |

### 2.2 Ubah (branding & workflow) — hanya di `apps/pos`

| Area | Perubahan | Implementasi M1 |
|------|-----------|-----------------|
| Workspace | Workspace `pos` baru | ✅ `packages/smart-ui/src/workspaces/pos/` (additive) + registrasi di `engine.js` |
| Branding teks | "SMART Inventory" → "POS.e-Profit" | ✅ title, topbar, login wrapper, dashboard `appName`, server name |
| Institution | Nama institusi aplikasi | ✅ override lokal `POS_INSTITUTION` di `apps/pos/src/main.js` — framework TIDAK diubah (Rule 3/10) |
| Logo | Logo POS.e-Profit | ⬜ M2 (upload via Console; slug `pos` sudah tersedia) |
| Sidebar/menu | Menu kasir | ⬜ M3 (menu inventory dipertahankan di scaffold) |
| Workflow kasir | POS Core UI | ⬜ M3 |

### 2.3 Tambah (extension, additive — tidak menyentuh engine inventory)

| Fitur [USULAN] | Jenis perubahan | Milestone |
|----------------|-----------------|-----------|
| Inventory Behavior (`trading`/`service`; `recipe` = roadmap) | Field `behavior` pada model Barang + hook di Transaction Engine (extension, bukan modifikasi engine) | M3 |
| Kasir Session / Shift | Model + route baru `pos` di server POS | M3 |
| Payment POS (tunai/QRIS manual) | Field pembayaran pada transaksi penjualan (additive) | M4 |
| Reporting Kasir | Route laporan baru (per shift/kasir) | M4 |
| Product Activation "pos" | Gate `Company.apps` (pola impersonation M4) di Console | M2 |

### 2.4 Tidak di-copy / dihapus

| Item | Alasan |
|------|--------|
| `apps/pos/server/__tests__/entitlement-check.test.js` | Duplikat test inventory (Rule 13 — hindari duplikasi; test asli tetap jalan di `apps/inventory`) |
| `.git` (nested repo inventory) | POS bagian root repo (pola console) |
| `.env`/secrets | Tidak pernah di-copy (gitignore) |
| `config/`, `docs/` legacy (kosong) | Tidak relevan |

---

## 3. Keputusan Arsitektur M1 (dicatat untuk ADR)

| # | Keputusan | Alasan |
|---|-----------|--------|
| K1 | `apps/pos` bagian **root repo** (bukan nested git) | Konsisten `apps/console`; file ikut ter-verifikasi lint/test |
| K2 | Port server POS **3003** (Inventory 3001, Console 3002); Vite dev **5175** | Tidak bentrok antar app |
| K3 | Branding via **override lokal** (`POS_INSTITUTION`, wrapper login, `appName`) — framework & `@smart/inventory-ui` TIDAK diubah | Golden Rule 3 & 10 (backward compatibility) |
| K4 | Workspace `pos` ditambahkan **additive** di `@smart/ui/src/workspaces/` | Konfigurasi-driven (Rule 17); fallback ke `default` untuk app lain tetap aman |
| K5 | Dependency server POS di-install **lokal** `apps/pos/server/node_modules` | Konvensi platform (Inventory & Console) |
| K6 | Root script `build:pos` + masuk `verify` | Setiap verify memastikan POS tetap build |
| K7 | Entitlement POS pakai feature slug **`pos`** (M1: `entitlement-check.js` di-rename `enforcePosEntitlement`/`POS_FEATURE`) | Aktivasi POS (M2) & enforcement (M4) membaca entitlement `pos`, bukan `inventory` — `BILLING_ENFORCEMENT` default `off` |
| K8 | Gate aktivasi produk di **login user** POS (bukan hanya impersonation) — `Company.apps` includes `pos` → 403 + audit | Product Activation (Task 4); inventory TIDAK diubah (backward compat) — hanya POS yang di-gate |
| K9 | Konfigurasi produk disertakan di **response login/impersonate** (`companyConfig`) → sessionStorage client | Menghindari HTTP dependency tambahan POS→Console; configuration driven (Rule 17) |
| K10 | Business Type = katalog 12 tipe (`apps/console/server/config/business-types.js` + client fallback) — SSOT server, whitelist di POST/PUT | Business Type (Task 5); daftar client harus sinkron |
| K11 | `pos.e-profit.id.conf` dibuat **HTTP-first** + instruksi certbot (bukan SSL cert master yang tidak valid utk domain baru) | Registrasi Task 1/M2-6; deploy live produksi menunggu persetujuan (tidak menjalankan nginx-deploy.sh/certbot) |

---

## 4. Status M0-3 (Scope PO) — ⬜ BELUM

Roadmap `pos_roadmap_v1.md` daftar isi memuat bab 4–18 (Workspace POS, Dashboard, POS Core,
Master Item, Inventory Behavior, Transaction Engine, Inventory Integration, Payment, Reporting,
User Role, MVP Scope, dst.) yang **belum terisi**. Menurut Golden Rule 12, eksekusi M3 (POS Core)
**tidak boleh dimulai** sebelum PO:
- melengkapi bab tersebut ATAU
- menyetujui ruang lingkup usulan di `docs/pos/pos_execution.md` §9.

---

## 5. Log

| Task | Status | Tanggal | Catatan |
|------|--------|---------|---------|
| M0-1 Audit baseline | ✅ | 2026-08-09 | Test 762/762, build 3 app ✓, lint baseline 20 error pre-existing |
| M0-2 Reuse map | ✅ | 2026-08-09 | Dokumen ini |
| M0-3 Scope PO | ⬜ | — | Blokir M3 |
| M1-1 Scaffold `apps/pos` | ✅ | 2026-08-09 | rsync clone, tanpa .git/node_modules/dist/.env |
| M1-2 Branding | ✅ | 2026-08-09 | Title, workspace `pos`, login/dashboard override, server `pos-api` |
| M1-3 Reuse engine/domain | ✅ | 2026-08-09 | `@smart/inventory-ui` + framework; test duplikat dihapus |
| M1-4 Regresi | ✅ | 2026-08-09 | Test 762/762, lint pos 0 error, build pos+inventory+console ✓ |
| M2-1..M2-5 Integrasi Master Platform | ✅ | 2026-08-09 | Gate `Company.apps` di login user POS; businessType/lokasiMode/jumlahGudang/jumlahKasir/lisensi di model+route+UI Companies; `companyConfig` di response login/impersonate; filter menu single-lokasi |
| M2-6 Registrasi platform | ✅* | 2026-08-09 | `apps.yaml` + `nginx/pos.e-profit.id.conf` (HTTP+certbot note) + monitoring entry; **deploy live belum dijalankan** |
| M2-7 Backward compatibility | ✅ | 2026-08-09 | Test **784/784** (22 test M2 baru), lint root tetap 20 baseline, build pos+inventory+console ✓ |
| M3-1..M3-6 POS Core | ✅ | 2026-08-09 | Behavior `trading/service` (Barang + form additive di `@smart/inventory-ui`), engine `sumber:"pos"` (paid+KWT+stok trading berkurang, jasa tidak — pure helper + 7 test), kasir screen (mockup kasir.html), role kasir, `GET /api/pos/kasir-data`; test **791/791**, lint root 20 baseline, build 3 app ✓ |
| M3-Deploy staging | ✅ | 2026-08-09 | `pos-api` PM2 :3003 online (health 200), `.env` (PORT 3003, APP_BASE_URL pos), dist rebuilt, bootstrap DB (PT-001 apps inventory,pos + user/role kasir + item jasa); smoke: `KWT-09082026-0001` paid, stok Aquaviva 200→199 |
| M3-Deploy live nginx | ⏳ | 2026-08-09 | `nginx-deploy.sh` + `certbot --nginx -d pos.e-profit.id` butuh sudo (password belum tersedia) — perintah siap dijalankan |
