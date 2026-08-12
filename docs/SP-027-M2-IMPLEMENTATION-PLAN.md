# SP-027 — MILESTONE 2: PLATFORM BACKEND SEPARATION

**Tanggal:** 2026-08-05 · **Branch:** `epic-002-inventory` · **Mode:** Architecture Implementation

---

## 1. Tujuan

Memisahkan backend Platform (Console) dari backend Inventory sehingga:

```
master.e-profit.id  →  apps/console         →  apps/console/server   (port 3002)  →  MongoDB
inv.e-profit.id     →  apps/inventory       →  apps/inventory/server (port 3001)  →  MongoDB
```

Tidak ada lagi kondisi di mana Console bergantung runtime kepada backend Inventory
(`apps/inventory/server`, port 3001).

## 2. Temuan Investigasi (bukti)

| Temuan | Bukti |
|---|---|
| Console saat ini diproxy ke 3001 (backend Inventory) | `platform/config/nginx/master.e-profit.id.conf` → `proxy_pass http://127.0.0.1:3001` |
| Endpoint Platform tinggal di Inventory Server | `apps/inventory/server/index.js` mount `/api/platform`, `/api/companies`, `/api/superadmins`, `/api/wilayah`, `/api/auth/register` |
| Console hanya memanggil endpoint Platform | `apps/console/src/services/*` + `apps/console/src/pages/*` → `/api/companies`, `/api/platform/*`, `/api/superadmins*`, `/api/wilayah/*` |
| Inventory UI MASIH memanggil sebagian endpoint Platform | `apps/inventory/src/main.js` → `GET /api/platform/logo` (+ fallback `/api/companies`), `GET /api/platform/app-logo/inventory` |
| Inventory router TIDAK punya halaman register aktif | `apps/inventory/src/router/routes.js` (tidak ada route `/register`) |
| `settings-data.js` (companies API) tidak dipakai modul lain | `grep listCompaniesApi|createCompanyApi|…` di `apps/inventory/src` → 0 pemanggil (dead code) |
| Logo platform tersimpan file-based | `apps/inventory/server/data/platform-logo.json`, `platform-app-logo-inventory.json` (tracked di submodule) |
| Seed platform (Company + SuperAdmin) ada di Inventory seed | `apps/inventory/server/seed.js` → `COMPANY_SEED`, `SUPERADMIN_SEED` |
| Database satu MongoDB, schema tidak boleh berubah | `apps/inventory/server/db.js` → `MONGO_URI` default `mongodb://127.0.0.1:27017/smart_inventory` |

## 3. Strategi (Backward-Compatible)

1. **Console Server baru** `apps/console/server` (port **3002**) — meniru pola Inventory Server:
   `config/ controllers/ middleware/ models/ routes/ services/ utils/ index.js package.json db.js seed.js data/ .env`
2. **Endpoint yang dipindah** (persis, tanpa perubahan logic):
   - `GET/POST/DELETE /api/platform/logo`, `GET/POST/DELETE /api/platform/app-logo/:slug`
   - `GET/POST/PUT/DELETE /api/companies/*`, `GET/POST/PUT/DELETE /api/superadmins/*`
   - `GET /api/wilayah/*`
   - `GET /api/auth/register/code` + `POST /api/auth/register` (rute utuh; register page inventory tidak aktif)
   - Models pendukung ikut: `Company`, `SuperAdmin`, `User` (data access lintas server, DB sama — bukan business logic)
3. **Inventory Server** (3001) hanya melayani business domain + auth user:
   auth, users, roles, permissions, barang, kategori, satuan, warehouse, supplier, customer, rak, pembelian, penjualan, sales, barang-gudang, transfer, stock-opname, inventory-monitoring, retur-*, laporan, activity, auth-google.
   Mount platform dihapus dari `index.js`; seed platform dipindah.
4. **nginx**:
   - `master.e-profit.id`: `/api/` → `127.0.0.1:3002` (Console API)
   - `inv.e-profit.id`: `/api/` → `127.0.0.1:3001`, DENGAN bridge sub-path untuk kompatibilitas UI Inventory yang belum dimigrasi:
     `/api/platform/`, `/api/auth/register/`, `/api/companies/`, `/api/superadmins/`, `/api/wilayah/` → `127.0.0.1:3002`
   (bridge hanya untuk endpoint Platform; seluruh business tetap 3001. Ini menjamin ZERO REGRESSION tanpa mengubah UI Inventory.)
5. **Environment dipisahkan**: `apps/console/server/.env` (PORT=3002, MONGO_URI dari DB yang sama), `apps/inventory/server/.env` tetap. `.env` level app (vite) dibuat minimal sebagai pemisahan konfigurasi.
6. **Data logo runtime**: dipindah ke `apps/console/server/data/` (dibaca hanya oleh route platform).

## 4. Daftar Perubahan

### Dibuat (baru)
```
apps/console/server/
  package.json
  .env                      (PORT=3002 + MONGO_URI)
  index.js                  (env loader, cors, health, mount 5 rute platform, error handler, graceful shutdown)
  db.js                     (connectDB + seedAll console)
  seed.js                   (Company + SuperAdmin seeds)
  config/.gitkeep
  controllers/.gitkeep
  middleware/.gitkeep
  services/.gitkeep
  utils/.gitkeep
  models/Company.js         (copy)
  models/SuperAdmin.js      (copy)
  models/User.js            (copy — data access utk sync admin di routes/companies)
  routes/companies.js       (copy)
  routes/superadmins.js     (copy)
  routes/platform.js        (copy)
  routes/wilayah.js         (copy, path shared/data/wilayah.json disesuaikan)
  routes/register.js        (copy)
  data/platform-logo.json           (dipindah dari inventory server/data)
  data/platform-app-logo-inventory.json (dipindah dari inventory server/data)
```

### Diubah
```
apps/inventory/server/index.js   (hapus import+mount platform/companies/superadmins/wilayah/register)
apps/inventory/server/seed.js    (hapus COMPANY_SEED, SUPERADMIN_SEED + block seed-nya; pertahankan TENANT_ID utk USER_SEED/BARANG_SEED)
platform/config/nginx/master.e-profit.id.conf  (proxy /api/ → 3002)
platform/config/nginx/inv.e-profit.id.conf     (proxy /api/ → 3001 + bridge sub-path → 3002)
```

### Dihapus
```
apps/inventory/server/data/platform-logo.json
apps/inventory/server/data/platform-app-logo-inventory.json
```

### Tidak disentuh (Golden Rules)
```
packages/smart-core, smart-ui, smart-api, smart-data, smart-config
packages/smart-inventory-ui
apps/inventory/src/** (UI), apps/console/src/** (UI)
Schema database / data migration
```

## 5. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Inventory UI kehilangan logo platform | nginx bridge `/api/platform/` → 3002 (tanpa ubah UI) |
| Inventory UI fallback `/api/companies` gagal | bridge `/api/companies/` → 3002 |
| Register page inventory (jika diaktifkan) | bridge `/api/auth/register/` → 3002 |
| Fresh install: Company di-seed console, User di-seed inventory | seed idempotent per collection; dokumentasikan urutan start (console dulu / independent) |
| Model User/Company/… duplikat di dua server | Disengaja: multi-service monorepo, satu DB, model = data-access layer, bukan business logic endpoint |
| Lint baru di apps/console/server | Ikuti standar apps/inventory/server (eslint meng-lint keduanya) |
| Server 3002 belum jalan saat nginx beralih | Ops: start console-api (pm2) dulu → nginx reload → restart inventory-api |

## 6. Verifikasi

- `npm run build --workspace=console` PASS, `npm run build --workspace=inventory` PASS
- `npm test` (509) PASS — tidak ada test server terpengaruh
- Smoke test lokal:
  - `apps/console/server` di port 3002 → `/api/health`, `/api/superadmins`, `/api/companies`, `/api/wilayah/provinces`, `/api/platform/logo`
  - `apps/inventory/server` (tanpa route platform) di port lain → `/api/health`, `/api/barang` OK; `/api/platform/logo` → 404 (harapan)
- Lint console/server bersih (standar inventory server)

## 7. Output Laporan

`docs/SP-027-M2-BACKEND-SEPARATION.md` berisi: Architecture Diagram, Backend Dependency Diagram, API Separation Report, Endpoint Mapping Table, nginx Mapping, Folder Structure, Build/Test/Regression Report, Migration Report, bukti path per perubahan.
