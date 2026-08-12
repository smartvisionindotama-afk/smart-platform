# SP-027 — MILESTONE 2: PLATFORM BACKEND SEPARATION

**Tanggal:** 2026-08-05 · **Branch:** `epic-002-inventory` · **Executor:** Freebuff · **Mode:** Architecture Implementation

---

## 1. Executive Summary

Backend Platform (Console) berhasil dipisahkan dari backend Inventory menjadi **dua backend independen**
yang berbagi satu MongoDB (schema tidak berubah, tanpa data migration):

```
master.e-profit.id  →  apps/console          →  apps/console/server    (port 3002)  →  MongoDB
inv.e-profit.id     →  apps/inventory        →  apps/inventory/server  (port 3001)  →  MongoDB
```

- Console Server baru `apps/console/server` (port **3002**) melayani seluruh endpoint Platform.
- Inventory Server (port **3001**) hanya melayani business domain + auth user.
- Tidak ada lagi endpoint Platform di Inventory Server (verified: semua 404).
- Console tidak lagi bergantung runtime pada backend Inventory.
- UI Inventory **tidak diubah** — kompatibilitas dijaga melalui nginx bridge sub-path.
- **Zero regression**: build PASS, test 509/509 PASS, smoke test kedua server PASS, `Seeded: {}` (tidak ada mutasi data).

---

## 2. Architecture Diagram

```
                    ┌──────────────────────────────────────────────┐
                    │                 nginx (:443)                  │
                    └───────────────┬───────────────┬───────────────┘
                                    │               │
                    master.e-profit.id         inv.e-profit.id
                     /api → :3002              /api → :3001
                                               + bridge platform → :3002
                                    │               │
                    ┌───────────────▼────┐   ┌──────▼────────────────┐
                    │  apps/console      │   │  apps/inventory       │
                    │  (SMART Console)   │   │  (SMART Inventory)    │
                    │  dist (SPA)        │   │  dist (SPA)           │
                    │  server/ (3002)    │   │  server/ (3001)       │
                    │  Platform API      │   │  Business API         │
                    └───────┬────────────┘   └──────┬────────────────┘
                            │                       │
                            └───────────┬───────────┘
                                        ▼
                                  ┌──────────┐
                                  │ MongoDB  │  smart_inventory (satu DB)
                                  └──────────┘
```

## 3. Backend Dependency Diagram

```
apps/console/server  ──►  @smart/core (tidak di-runtime; frontend)      apps/inventory/server ──►  business models
      │                    express, cors, mongoose                              │
      ▼                                                                         ▼
  models/Company.js, SuperAdmin.js, User.js  ──(mongoose)──►  MongoDB (collection: companies, superadmins, users)
      │
  routes/companies, superadmins, platform, wilayah, register
```

- Kedua server adalah aplikasi Express ESM mandiri (`apps/*/server/index.js`), pola identik
  (env loader inline, CORS, health, error handler, graceful shutdown).
- Tidak ada import lintas-server. Keduanya hanya bergantung pada `express`, `cors`, `mongoose`
  (inventory juga `nodemailer`, `resend` untuk email).

## 4. API Separation Report

### 4.1 Dipindah ke `apps/console/server` (3002) — Platform API

| # | Method | Path | File bukti |
|---|--------|------|------------|
| 1 | GET | `/api/platform/logo` | `apps/console/server/routes/platform.js` |
| 2 | POST | `/api/platform/logo` | `apps/console/server/routes/platform.js` |
| 3 | DELETE | `/api/platform/logo` | `apps/console/server/routes/platform.js` |
| 4 | GET | `/api/platform/app-logo/:slug` | `apps/console/server/routes/platform.js` |
| 5 | POST | `/api/platform/app-logo/:slug` | `apps/console/server/routes/platform.js` |
| 6 | DELETE | `/api/platform/app-logo/:slug` | `apps/console/server/routes/platform.js` |
| 7 | GET | `/api/companies` | `apps/console/server/routes/companies.js` |
| 8 | GET | `/api/companies/:id` | `apps/console/server/routes/companies.js` |
| 9 | POST | `/api/companies` | `apps/console/server/routes/companies.js` |
| 10 | PUT | `/api/companies/:id` | `apps/console/server/routes/companies.js` |
| 11 | DELETE | `/api/companies/:id` | `apps/console/server/routes/companies.js` |
| 12 | POST | `/api/superadmins/login` | `apps/console/server/routes/superadmins.js` |
| 13 | GET | `/api/superadmins` | `apps/console/server/routes/superadmins.js` |
| 14 | POST | `/api/superadmins` | `apps/console/server/routes/superadmins.js` |
| 15 | PUT | `/api/superadmins/:id` | `apps/console/server/routes/superadmins.js` |
| 16 | DELETE | `/api/superadmins/:id` | `apps/console/server/routes/superadmins.js` |
| 17 | GET | `/api/wilayah` | `apps/console/server/routes/wilayah.js` |
| 18 | GET | `/api/wilayah/provinces` | `apps/console/server/routes/wilayah.js` |
| 19 | GET | `/api/wilayah/:prov/regencies` | `apps/console/server/routes/wilayah.js` |
| 20 | GET | `/api/wilayah/:prov/:kab/districts` | `apps/console/server/routes/wilayah.js` |
| 21 | GET | `/api/wilayah/:prov/:kab/:kec/villages` | `apps/console/server/routes/wilayah.js` |
| 22 | POST | `/api/wilayah/refresh` | `apps/console/server/routes/wilayah.js` |
| 23 | POST | `/api/auth/register` | `apps/console/server/routes/register.js` |
| 24 | GET | `/api/auth/register/code` | `apps/console/server/routes/register.js` |
| 25 | GET | `/api/health` | `apps/console/server/index.js` |

> Semua file rute/model di atas adalah **salinan identik** dari Inventory Server (`diff` terbukti identik
> untuk `wilayah.js`; seluruh rute di-copy tanpa perubahan logic) — memenuhi aturan "tidak mengubah business logic".
> Models `Company`, `SuperAdmin`, `User` di-copy sebagai *data-access layer* (server berbagi satu DB,
> bukan business logic endpoint).

### 4.2 Tetap di `apps/inventory/server` (3001) — Business & Identity API

`/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/google/*`,
`/api/users`, `/api/roles`, `/api/permissions`, `/api/barang`, `/api/kategori`, `/api/satuan`,
`/api/warehouse`, `/api/supplier`, `/api/customer`, `/api/rak`, `/api/pembelian`, `/api/penjualan`,
`/api/sales`, `/api/barang-gudang`, `/api/transfer`, `/api/stock-opname` (+ `/barang-stock`),
`/api/inventory-monitoring`, `/api/retur-pembelian`, `/api/retur-penjualan`, `/api/laporan`,
`/api/activity`, `/api/health` — bukti: `apps/inventory/server/index.js` (mount tersisa).

### 4.3 Konsumen frontend

| Frontend | Endpoint Platform yang dipakai | Bukti |
|---|---|---|
| Console | `/api/companies*`, `/api/superadmins*`, `/api/platform/*`, `/api/wilayah/*` | `apps/console/src/services/companies.js`, `superadmins.js`, `platform.js`, `pages/companies/index.js` |
| Inventory (legacy, dibiarkan) | `GET /api/platform/logo`, `GET /api/platform/app-logo/inventory`, fallback `/api/companies` | `apps/inventory/src/main.js` (`fetchCompanyLogo`), `apps/inventory/src/data/settings-data.js` (dead code, 0 pemanggil) |

## 5. nginx Mapping

| File | Domain | Location | Proxy |
|---|---|---|---|
| `platform/config/nginx/master.e-profit.id.conf` | master.e-profit.id | `/api/` | `http://127.0.0.1:3002` (Console API) |
| `platform/config/nginx/inv.e-profit.id.conf` | inv.e-profit.id | `/api/platform/`, `/api/auth/register/`, `/api/companies/`, `/api/superadmins/`, `/api/wilayah/` | `http://127.0.0.1:3002` (bridge backward-compat) |
| `platform/config/nginx/inv.e-profit.id.conf` | inv.e-profit.id | `/api/` | `http://127.0.0.1:3001` (Inventory Business API) |

> Bridge hanya untuk endpoint Platform yang masih dipanggil UI Inventory; seluruh business API tetap 3001.
> Bridge dapat dihapus setelah UI Inventory dimigrasi memakai Console API / domain master.

## 6. Folder Structure

```
apps/console/server/
  package.json          @smart/console-server (express, cors, mongoose)
  .env                  PORT=3002 + MONGO_URI (satu DB, schema tidak berubah)
  index.js              boot server (env loader, CORS, health, mount rute, error handler)
  db.js                 connectDB + seed platform (idempotent)
  seed.js               Company + SuperAdmin seeds (dipindah dari inventory seed)
  config/.gitkeep
  controllers/.gitkeep
  middleware/.gitkeep
  services/.gitkeep
  utils/.gitkeep
  models/Company.js  SuperAdmin.js  User.js
  routes/companies.js  superadmins.js  platform.js  wilayah.js  register.js
  data/platform-logo.json  platform-app-logo-inventory.json   (runtime logo, dipindah)
  node_modules/  package-lock.json
```

## 7. Build Report

| Target | Hasil |
|---|---|
| `npm run build --workspace=console` | ✅ PASS — built in 815ms |
| `npm run build --workspace=inventory` | ✅ PASS — built in 763ms |

## 8. Test Report

| Target | Hasil |
|---|---|
| `npm test` | ✅ **509 passed (509)** — tidak ada test server terpengaruh (tidak ada test pada `apps/*/server`) |
| `npx eslint apps/console/server` | ⚠️ 11 error `no-undef` (node-globals `process`/`Buffer`) + 3 warning — **sama jenis dengan baseline pra-eksisting** `apps/inventory/server` (21 error `no-undef`), berasal dari konfigurasi lint global `@smart/config/eslint` yang tidak mengaktifkan env node; bukan cacat migrasi |

## 9. Regression Report (Smoke Test)

### 9.1 Console Server (3002) — `apps/console/server/index.js`

| Endpoint | Hasil |
|---|---|
| `GET /api/health` | ✅ `{"status":"ok","service":"smart-console-api",…}` |
| `GET /api/superadmins` | ✅ data produksi (fahriejay, dll) |
| `GET /api/companies` | ✅ data produksi (Pemdes Keboharan, dll) |
| `GET /api/wilayah/provinces` | ✅ 34 provinsi |
| `GET /api/platform/logo` | ✅ HTTP 200, 32.738 B (logo ikut dipindah) |
| `GET /api/auth/register/code?jenis=PT` | ✅ `{"code":"PT-002"}` |
| Startup | ✅ `[Console DB] Seeded: {}` → **tidak ada mutasi data** |

### 9.2 Inventory Server (tanpa platform routes, port uji 3099)

| Endpoint | Hasil |
|---|---|
| `GET /api/health` | ✅ |
| `GET /api/barang` (business) | ✅ data produksi |
| `GET /api/platform/logo` | ✅ **404** (endpoint hilang sesuai target) |
| `GET /api/superadmins` | ✅ **404** |
| `GET /api/companies` | ✅ **404** |
| `GET /api/wilayah/provinces` | ✅ **404** |
| `GET /api/auth/register` | ✅ **404** |
| Startup | ✅ `[DB] Seeded: {}` → **tidak ada mutasi data** |

## 10. Migration Report

| Perubahan | File | Tipe |
|---|---|---|
| Console server baru | `apps/console/server/**` (25 file) | DIBUAT |
| Rute platform dihapus dari inventory | `apps/inventory/server/index.js` | DIUBAH |
| Seed platform dipindah | `apps/inventory/server/seed.js` → `apps/console/server/seed.js` | DIUBAH |
| nginx master → 3002 | `platform/config/nginx/master.e-profit.id.conf` | DIUBAH |
| nginx inv bridge + 3001 | `platform/config/nginx/inv.e-profit.id.conf` | DIUBAH |
| Data logo runtime pindah | `apps/inventory/server/data/*.json` → `apps/console/server/data/*.json` | DIPINDAH |
| Env backend terpisah | `apps/console/server/.env` (baru), `apps/inventory/server/.env` (tetap) | DIBUAT |
| Env frontend terpisah | `apps/console/.env`, `apps/inventory/.env` | DIBUAT |
| Dependencies console server | `apps/console/server/package.json`, `package-lock.json` | DIBUAT |

### Kebijakan data & seed
- Satu MongoDB `smart_inventory`; **tidak ada perubahan schema, tidak ada migration data**.
- Seed Company/SuperAdmin kini milik Console (`apps/console/server/seed.js`); seed business tetap di Inventory.
  Keduanya idempotent (`Seeded: {}` saat data sudah ada) → fresh-install cukup menjalankan kedua server.
- Catatan fresh-install: seed Inventory (`USER_SEED`/`BARANG_SEED`) mereferensikan `PT-001` yang di-seed Console;
  urutan start disarankan Console dulu, namun seed berjalan per-collection sehingga tidak blokir.

### Catatan arsitektur
- Duplikasi model `Company/SuperAdmin/User` di kedua server adalah **disengaja** (multi-service, satu DB):
  model = data-access layer; endpoint business hanya di Inventory, endpoint platform hanya di Console.
- Lint `no-undef` node-globals pada kedua server adalah **utang konfigurasi pra-eksisting**
  (`@smart/config/eslint` tidak men-set env node) — di luar scope M2.

## 11. Status

- ✅ Console punya backend sendiri (3002)
- ✅ Inventory punya backend sendiri (3001)
- ✅ Tidak ada Platform API di Inventory Server (verified 404)
- ✅ Tidak ada Business API di Console Server (hanya 5 grup rute platform)
- ✅ master.e-profit.id → Console API (nginx config siap; butuh deploy)
- ✅ inv.e-profit.id → Inventory API + bridge kompatibilitas
- ✅ Build PASS · Test PASS · Zero regression · Zero data mutation
- ⏳ Ops live (pm2 start `console-api` + copy nginx + reload + restart `inventory-api`) — menunggu konfirmasi

## 12. Catatan Hasil Review Internal

| # | Temuan | Level | Status |
|---|---|---|---|
| 1 | `apps/console/server/.env` berisi kredensial `MONGO_URI`; root `.gitignore` tidak meng-ignore `.env` → risiko kebocoran ke commit | 🔴 HIGH | **FIXED** — `.gitignore` ditambah pola `.env` (verified `git add -n` bersih) |
| 2 | Urutan ops wajib: (1) start `console-api` (3002) → (2) copy nginx + reload (bridge aktif) → (3) restart `inventory-api`. Jangan restart inventory-api sebelum bridge aktif (UI inventory fetch `/api/platform/logo`) | 🟠 MEDIUM | Dijadwalkan di ops |
| 3 | `routes/register.js` warning lint `'Model' unused` (26:11) — dead code bawaan ikut ter-copy dari inventory, dibiarkan demi prinsip copy-identik | 🟡 LOW | Diterima (konsisten baseline) |
| 4 | `apps/inventory/server/routes/auth.js` (forgot/reset-password) masih menyentuh collection `superadmins` — entity platform ditangani backend business; inheren scope M2 (auth.js tidak diminta dipindah) | 🟡 LOW | Utang milestone auth berikutnya |
| 5 | Fresh-install: `USER_SEED`/`BARANG_SEED` (inventory) mereferensikan `PT-001` yang di-seed console server — start console dulu | 🟡 LOW | Dokumentasi di §10 |
| 6 | `platform/config/nginx/*.conf` tidak pernah di-track git (konsisten kondisi repo); deploy nginx via working tree | ℹ️ INFO | Ops manual |
