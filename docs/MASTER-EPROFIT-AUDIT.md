# MASTER-EPROFIT-AUDIT

Audit menyeluruh (READ-ONLY) terhadap **master.e-profit.id**.

- **Tanggal Audit:** 2026-08-04
- **Branch:** `epic-002-inventory`
- **Metode:** Investigasi kode langsung (tidak ada perubahan kode, tidak ada commit, tidak ada refactoring).
- **Aturan Bukti:** Setiap kesimpulan menyertakan path file. Jika tidak ditemukan bukti → **UNKNOWN**.

---

## RINGKASAN EKSEKUTIF

**master.e-profit.id BUKAN aplikasi terpisah.** Berdasarkan kode:

1. Nginx `master.e-profit.id` mengarah ke **build statis yang sama** dengan `inv.e-profit.id` (`/srv/apps/inventory/dist`), dan mem-proxy `/api/` ke Express `127.0.0.1:3001` yang sama. → Bukti: `platform/config/nginx/master.e-profit.id.conf`, `platform/config/nginx/inv.e-profit.id.conf`.
2. Mode aplikasi ditentukan **di client** berdasarkan hostname: `host === 'master.e-profit.id'` → mode `platform` (Super Admin / Platform Dashboard), selain itu mode `inventory`. Fallback development: path `/platform`. → Bukti: `apps/inventory/src/main.js` → `getAppMode()`.
3. Jadi "SMART Console" saat ini **tidak berdiri sendiri** — ia adalah **mode platform** di dalam aplikasi Inventory, dengan UI di `packages/smart-ui/src/modules/platform/` (login + dashboard) dan wrapper di `apps/inventory/src/pages/platform/`.
4. Kesiapan menjadi SMART Console sesuai SP-027: **±35%** (fondasi framework & sebagian besar modul konsol tersedia, tetapi belum mandiri, belum ada auth server-side yang aman, belum ada billing/subscription tersimpan, belum ada monitoring infrastruktur).

---

## 1. PROJECT OVERVIEW

| Aspek | Temuan | Bukti |
|---|---|---|
| **Tujuan aplikasi** | master.e-profit.id = domain untuk **Super Admin Platform** (dashboard administrasi ekosistem: aplikasi, perusahaan, user platform, pengaturan logo). Secara teknis ia memuat aplikasi Inventory dalam mode `platform`. | `apps/inventory/src/main.js` (`getAppMode()`, `showPlatformDashboard()`); `docs/SP-027 — SMART CONSOLE FOUNDATION` |
| **Teknologi frontend** | Vanilla JavaScript (ESM), tanpa framework UI. Vite sebagai bundler. | `apps/inventory/package.json` (dependencies: `vite`, `@smart/inventory-ui`, `html5-qrcode`, `jsqr`); `docs/adr/ADR-003-vanilla-javascript.md` |
| **Framework** | Monorepo npm workspaces; package framework: `@smart/core`, `@smart/ui`, `@smart/api`, `@smart/data`, `@smart/inventory-ui`, `@smart/config`. | `package.json` (workspaces: `packages/*`, `apps/*`) |
| **Backend** | Node.js + Express 4 (single server di `apps/inventory/server`). | `apps/inventory/server/index.js`, `apps/inventory/server/package.json` |
| **Database** | MongoDB Community via Mongoose 8. DB default: `smart_inventory` (`mongodb://127.0.0.1:27017/smart_inventory`). Seed otomatis saat DB kosong. | `apps/inventory/server/db.js`, `apps/inventory/server/seed.js` |
| **Authentication** | Login berbasis username/password terhadap koleksi Mongo (`users`, `superadmins`). **Password disimpan plaintext** (dibandingkan langsung `user.password !== password`). Tidak ada JWT dari server, tidak ada cookie/httpOnly session server. Session & token hanya di client (in-memory + storage). | `apps/inventory/server/routes/auth.js`, `apps/inventory/server/routes/superadmins.js`, `packages/smart-core/src/auth/session.js` |
| **Authorization** | RBAC klien: `Permission.can()` dengan sinkronisasi permission dari server (`/api/permissions/roles`). **Tidak ada middleware otorisasi di server** — semua route Express terbuka; scope tenant hanya lewat header `x-company-code` (opsional). | `packages/smart-core/src/permission/permission.js`, `packages/smart-core/src/permission/roles.js`, `apps/inventory/server/routes/barang.js` |
| **Build system** | `vite build` per aplikasi (`npm run build --workspace=inventory`). Root script: `test`, `lint`, `verify`. | `package.json`, `apps/inventory/vite.config.js` |
| **Deployment** | Build statis Vite disajikan Nginx (`root /srv/apps/inventory/dist`, SPA fallback), `/api/` di-proxy ke Express 3001, SSL Certbot, PM2 untuk server, script deploy manual. | `platform/config/nginx/master.e-profit.id.conf`, `platform/deploy/nginx-deploy.sh`, `platform/scripts/health-check.sh`, `docs/execution_status.md` |

Catatan: `docs/execution_status.md` mencatat sejarah implementasi (mis. "Production Deployment: Build + Nginx Static Serve", "Nginx Deploy: master.e-profit.id + inv.e-profit.id", "SSL Certificate via Certbot") — konsisten dengan temuan di atas.

---

## 2. FOLDER STRUCTURE

```
/srv (root monorepo)
├── apps/                          # Aplikasi (workspace npm)
│   ├── _template/                 # Template aplikasi SMART (contoh struktur app)
│   ├── inventory/                 # Satu-satunya aplikasi nyata — Sumber master.e-profit.id
│   │   ├── src/
│   │   │   ├── main.js            # Entry point + deteksi mode platform/inventory
│   │   │   ├── config/menu.js     # Menu sidebar berbasis permission
│   │   │   ├── router/            # Router SPA + daftar route
│   │   │   ├── pages/             # Thin wrapper halaman (login, platform, settings, dll)
│   │   │   ├── data/              # Data service (API-first + fallback lokal)
│   │   │   └── css/ components/ playground/
│   │   └── server/                # Backend Express + MongoDB (satu-satunya API)
│   │       ├── index.js           # Entry server, mount semua route
│   │       ├── routes/            # 30+ route file
│   │       ├── models/            # 21 model Mongoose
│   │       ├── services/email.js  # Email: Resend + Nodemailer SMTP
│   │       ├── seed.js            # Seed data awal
│   │       └── db.js              # Koneksi MongoDB
│   └── smartvindo/                # Situs marketing smartvindo.com (bukan console)
├── packages/                      # Framework & domain packages (SDK)
│   ├── smart-core/                # @smart/core — engine: auth, session, permission, company, platform, impersonation, audit
│   ├── smart-ui/                  # @smart/ui — UI framework: komponen, layout, workspace, modul settings/auth/platform
│   ├── smart-api/                 # @smart/api — HTTP client, interceptor, fallback
│   ├── smart-data/                # @smart/data — repository, state, cache, pagination, mongo abstraction
│   ├── smart-inventory-ui/        # @smart/inventory-ui — modul bisnis Inventory (dashboard, barang, pembelian, penjualan, transfer, laporan)
│   └── smart-config/              # @smart/config — eslint & vite config bersama
├── platform/                      # Infrastruktur & operasional
│   ├── config/nginx/              # Konfigurasi Nginx per domain (master.e-profit.id, inv.e-profit.id)
│   ├── deploy/ bootstrap/ scripts/ monitoring/ docs/ templates/
├── shared/data/wilayah.json       # Dataset wilayah Indonesia (provinsi s.d. desa)
└── docs/                          # Dokumentasi arsitektur (SP-xxx), ADR, roadmap, execution_status
```

Fungsi per folder penting:

- `apps/` — aplikasi yang bisa dijalankan/di-build. Hanya `inventory` yang berisi kode nyata; `_template` adalah template; `smartvindo` adalah situs marketing.
- `packages/` — SDK yang dipakai aplikasi. **Tidak ada package `console`** (SP-027 mensyaratkan `apps/console`; belum ada). → Bukti: `docs/SP-027 — SMART CONSOLE FOUNDATION` (#4 PACKAGE) vs isi direktori `packages/` & `apps/`.
- `platform/` — konfigurasi infra (nginx), bukan kode aplikasi.

---

## 3. ENTRY POINT

**Main entry:** `apps/inventory/index.html` → `<script type="module" src="/src/main.js">` → `start()`.

**Alur startup (`apps/inventory/src/main.js`):**

1. `loadUI()` (muat tokens/komponen UI), log versi app.
2. `getAppMode()` — hostname `master.e-profit.id` → `platform`; path `/platform` (dev) → `platform`; selainnya `inventory`. Set `document.title`.
3. Restore sesi impersonasi dari `sessionStorage` (`smart_impersonation`) bila ada.
4. Cek route `/reset-password?token=&email=` → tampilkan halaman reset password.
5. Jika `Auth.isLoggedIn()`:
   - role `superadmin` (tanpa impersonasi) → `showPlatformDashboard()`.
   - selainnya → `loadWorkspace(Institution.current().workspace)` lalu `renderApp()`.
6. Jika belum login: mode `platform` → `showSuperAdminLogin()`; mode `inventory` → `showLogin()`.

**Login:**
- Login user biasa: `LoginPage` = `packages/smart-ui/src/modules/auth/login.js` (di-wrap `apps/inventory/src/pages/login/index.js`). Login memanggil API, lalu mengeset `Auth.currentUser` langsung. → Bukti: `packages/smart-ui/src/modules/auth/login.js` (baris `Auth.currentUser = {...}`), `apps/inventory/src/data/api.js` (`apiLogin`).
- Login Super Admin: `SuperAdminLoginPage` = `packages/smart-ui/src/modules/platform/login.js` → `POST /api/superadmins/login`. → Bukti: `apps/inventory/src/data/superadmin-data.js`.

**Dashboard:**
- Dashboard Platform (Super Admin): `PlatformDashboardModule` di `packages/smart-ui/src/modules/platform/dashboard.js`, di-render via `apps/inventory/src/pages/platform/index.js` → `showPlatformDashboard()`. 4 view: **Aplikasi** (grid app + upload logo), **Kelola Perusahaan**, **User** (superadmin CRUD), **Pengaturan**.
- Dashboard Inventory (user perusahaan): `InventoryDashboard` di `packages/smart-inventory-ui/src/modules/dashboard/index.js`.

**Router:** `apps/inventory/src/router/index.js` + `routes.js` — daftar route dengan `component`/`init`/`permission`; navigasi diverifikasi `Auth.isLoggedIn()` di `handleNavigate()`.

**Layout:** `AppShell` (sidebar + topbar + content) dari `packages/smart-ui/src/layouts/` (`Shell.js`, `Sidebar.js`, `Topbar.js`); topbar menampilkan badge impersonasi "LOGIN AS [Company]".

**Alur impersonasi (Login As Company Admin):** `startImpersonation()` di `dashboard.js` → `audit.logImpersonationStart()` → set company context → `impersonation.start(..., 3600000)` → simpan ke `sessionStorage` → reload → AppShell dengan badge. Keluar: `exitImpersonation()` di `main.js`.

---

## 4. MODULE INVENTORY

Status: ✅ Digunakan · 🟡 Parsial/terbatas · ⚪ Tidak digunakan / dormant · ❌ Tidak ada.

| # | Module | Lokasi | Status | Digunakan? | Dependency |
|---|---|---|---|---|---|
| 1 | **Dashboard (Platform/Super Admin)** | `packages/smart-ui/src/modules/platform/dashboard.js` | ✅ | Ya — via `apps/inventory/src/pages/platform/index.js` | `@smart/core` (Auth, platform, impersonation, audit, COMPANY_TYPES), `@smart/ui` (Modal, Toast, UI) |
| 2 | **Login Super Admin** | `packages/smart-ui/src/modules/platform/login.js` | ✅ | Ya — `main.js showSuperAdminLogin()` | `@smart/core` Auth |
| 3 | **Aplikasi (Application registry)** | `packages/smart-core/src/platform/index.js` (`BUILTIN_APPS`) | 🟡 | Ya (UI) — tapi registry hardcoded, hanya `inventory` aktif | `@smart/core` |
| 4 | **Perusahaan (Company)** | server `routes/companies.js`, model `Company.js`; UI `packages/smart-ui/src/modules/settings/company.js` + platform dashboard | ✅ | Ya | Mongoose, `@smart/ui`, `@smart/core` |
| 5 | **User** | server `routes/users.js`, model `User.js`; UI `packages/smart-ui/src/modules/settings/user.js` | ✅ | Ya | Mongoose |
| 6 | **Role** | server `routes/roles.js`, model `Role.js`; UI `settings/role.js` | ✅ | Ya | Mongoose |
| 7 | **Permission** | server `routes/permissions.js`, model `Permission.js`; engine `packages/smart-core/src/permission/*` | ✅ | Ya | Mongoose + client sync |
| 8 | **Super Admin (platform user)** | server `routes/superadmins.js`, model `SuperAdmin.js`; UI platform dashboard | ✅ | Ya | Mongoose |
| 9 | **Subscription** | **Tidak ada server-side.** Hanya in-memory client: `platform.enableAppForCompany/disableAppForCompany` di `packages/smart-core/src/platform/index.js` + toggle "📋 Subs" di `dashboard.js` | ❌ (stub client) | Tidak (tidak persist) | `@smart/core` |
| 10 | **License** | **Stub hardcoded**: `license: () => ({ status: "active", type: "enterprise" })` di `packages/smart-core/src/facade.js` | ❌ (stub) | Tidak | `@smart/core` |
| 11 | **Billing / Invoice / Payment / Package** | Tidak ditemukan di server (`grep subscription|license|billing|package|invoice` di `apps/inventory/server` → 0 match). Hanya desain dokumen `docs/SP-022-BILLING-SUBSCRIPTION-ARCHITECTURE.md` | ❌ | Tidak | — |
| 12 | **Workspace** | `packages/smart-ui/src/workspaces/` (`default`, `corporate`, `warehouse` — statis JSON + CSS) + `engine.js`/`schema.js` | 🟡 | Ya (loadWorkspace) — statis, bukan per-tenant dinamis | `@smart/ui` |
| 13 | **Domain / Subdomain** | Tidak ada modul. Routing domain hanya konfigurasi Nginx statis + deteksi hostname client | ❌ | — | `platform/config/nginx/*` |
| 14 | **Monitoring (infrastruktur)** | Tidak ada. Hanya `GET /api/health` (server) + script shell + monitoring **bisnis** inventory (`routes/inventory-monitoring.js`) | ❌ / 🟡 (bisnis saja) | Parsial | Express |
| 15 | **Audit** | Client: `packages/smart-core/src/audit/index.js` (in-memory, opsional sync). Server: `ActivityLog` model + `routes/activity.js` (CRUD log aktivitas inventory) | 🟡 | Ya (activity log inventory); audit platform in-memory | `@smart/core`, Mongoose |
| 16 | **Notification** | Tidak ditemukan modul notifikasi realtime | ❌ | — | — |
| 17 | **Email** | `apps/inventory/server/services/email.js` — Resend (primary) + Nodemailer SMTP (fallback). Dipakai untuk forgot/reset password | ✅ | Ya | `resend`, `nodemailer` |
| 18 | **Deployment** | Tidak ada modul di aplikasi. Hanya script manual `platform/deploy/nginx-deploy.sh`, `platform/bootstrap/bootstrap.sh` | ❌ (script, bukan modul) | Manual | — |
| 19 | **Settings (company/logo platform)** | `routes/platform.js` (logo platform & logo per-app, file-based) + view "Pengaturan" di platform dashboard | ✅ | Ya | Express, fs |
| 20 | **Auth (user)** | server `routes/auth.js`; UI `modules/auth/*` (login, register, reset-password, forgot-password); Google `routes/auth-google.js` | ✅ | Ya | Mongoose |
| 21 | **Auth (Google)** | `routes/auth-google.js` — terima token OAuth2 client-side + info user dari `googleapis.com/oauth2/v3/userinfo`; **tidak ada verifikasi idToken server** | 🟡 | Ya (register/login) | Express |
| 22 | **Wilayah** | `routes/wilayah.js` + `shared/data/wilayah.json` (provinsi→desa) | ✅ | Ya (registrasi BUMDes/Pemdes) | Express |
| 23 | **Impersonation** | `packages/smart-core/src/impersonation/index.js` + `sessionStorage` | ✅ | Ya | `@smart/core` |
| 24 | **Business: Inventory** | `packages/smart-inventory-ui/src/modules/*` + `apps/inventory/server/routes/*` + `apps/inventory/src/data/*` | ✅ | Ya | Vite, Mongoose, `@smart/api` |
| 25 | **Business: Accounting / POS / WMS / SITAMPAN / Santri Pintar / e-Profit / Desa Insight** | Hanya entri registry `BUILTIN_APPS` (semua `active: false`) | ⚪ | Tidak — dormant | `@smart/core` |

---

## 5. FEATURE INVENTORY

Status: **IMPLEMENTED** · **PARTIAL** · **STUB** · **UNUSED** · **UNKNOWN**.

| Feature | Status | Alasan (bukti) |
|---|---|---|
| Login user (username/email + password, validasi ke Mongo) | IMPLEMENTED | `routes/auth.js` `POST /login` |
| Login Super Admin terpisah | IMPLEMENTED | `routes/superadmins.js` `POST /login`; `docs/execution_status.md` "Login Separation (Super Admin vs User)" |
| Registrasi company + admin (auto kode) | IMPLEMENTED | `routes/register.js` `POST /auth/register` + `GET /auth/register/code` |
| Forgot / reset password via email token | IMPLEMENTED (PARTIAL keamanan) | `routes/auth.js` forgot/reset; token disimpan plaintext di DB; email via `services/email.js` |
| Google login/register | PARTIAL | `routes/auth-google.js` — percaya data userinfo client-side, tanpa verifikasi token server |
| Logout | IMPLEMENTED (client-only) | `packages/smart-core/src/auth/auth.js` `logout()`; `main.js handleLogout()` — tidak ada invalidasi server |
| Session server / JWT / refresh token / cookie | **TIDAK ADA** | Server hanya balas JSON user; token `smt_…` dibuat & disimpan di client (`packages/smart-core/src/auth/session.js`). Tidak ada `jsonwebtoken`/`cookie` di `apps/inventory/server/package.json` |
| RBAC client (permission namespace, sync server) | IMPLEMENTED | `packages/smart-core/src/permission/permission.js` `syncFromServer()`, `engine.js`, `routes/permissions.js` |
| Otorisasi server per-route | **TIDAK ADA** | Semua route Express tanpa middleware auth; contoh `routes/barang.js` membaca header opsional `x-company-code` |
| Company CRUD (platform) | IMPLEMENTED | `routes/companies.js` (GET/POST/PUT/DELETE), UI platform dashboard |
| Disable/Enable company | IMPLEMENTED | `routes/companies.js` (field `active`), `dashboard.js toggleCompanyStatus()`; login user memblokir company non-aktif (`routes/auth.js`) |
| Impersonation (Login As) | IMPLEMENTED | `packages/smart-core/src/impersonation/index.js`, `dashboard.js startImpersonation()`, badge di `Topbar.js` |
| App registry + mapping company↔app | PARTIAL | `packages/smart-core/src/platform/index.js` — hardcoded, in-memory, **tidak persist** |
| Subscription toggle per company | STUB (client-only) | `dashboard.js manageSubscription()` memanggil `platform.enable/disableAppForCompany` (in-memory). Tidak ada collection/subscription di Mongo |
| License | STUB | `packages/smart-core/src/facade.js` — hardcoded `{status:'active', type:'enterprise'}` |
| Billing/invoice/payment/package/renewal/upgrade/downgrade/trial/expired | **TIDAK ADA** | grep server → 0 match; hanya dokumen `docs/SP-022-*` |
| Platform logo & app logo (upload) | IMPLEMENTED | `routes/platform.js` (file JSON di `server/data/`) |
| Monitoring infrastruktur (CPU/RAM/disk/PM2/Mongo/Redis) | **TIDAK ADA** | SP-027 #6 mensyaratkan; tidak ada endpoint/UI. `platform/monitoring/server-info.txt` hanya artefak bootstrap |
| Monitoring bisnis inventory | IMPLEMENTED | `routes/inventory-monitoring.js` (stats, by-warehouse, low-stock, out-of-stock, recent-movement, stock-value) |
| Health check | IMPLEMENTED | `GET /api/health` (`server/index.js`); `platform/scripts/health-check.sh` |
| Activity log inventory | IMPLEMENTED | `models/ActivityLog.js`, `routes/activity.js`, auto header `x-user-name` |
| Audit platform (impersonation/login/logout) | PARTIAL | `packages/smart-core/src/audit/index.js` — in-memory, `setSync` opsional, tidak ada persisten server |
| Workspace engine | PARTIAL | `packages/smart-ui/src/workspaces/` — statis (default/corporate/warehouse); bukan dinamis per-tenant |
| Database manager di console | **TIDAK ADA** | SP-027 #11 (read-only) — tidak ditemukan |
| AI monitoring | **TIDAK ADA** | SP-027 #12 — tidak ditemukan |
| Multi-role console (Super Admin/Developer/Operator/Readonly) | **TIDAK ADA** | Hanya role `superadmin` di `routes/superadmins.js`; SP-027 #13 |
| Demo user hardcoded (admin/operator) di framework | UNUSED (legacy) | `packages/smart-core/src/auth/auth.js` `users = {admin, operator}`; login produksi via API (execution_status mencatat demo credentials dihapus dari UI) |

---

## 6. DATABASE

**Engine:** MongoDB Community Server via Mongoose 8. DB default: `smart_inventory`. Koneksi & seed otomatis di `apps/inventory/server/db.js`.

**Migrations:** **TIDAK ADA tooling migrasi** (tidak ada folder migrations, tidak ada library migrasi di `apps/inventory/server/package.json`). Yang ada: `seed.js` (idempotent, skip bila koleksi terisi) dan dokumen `docs/mongodb-migration-report.md` / `docs/SP-025-migration-report.md` (laporan, bukan tooling).

**Models (21) — `apps/inventory/server/models/`:**

| Model | Koleksi (Mongoose pluralize) | Field kunci multi-tenant |
|---|---|---|
| `Company.js` | companies | `code` (unique), `jenis`, `tenantId`/`tenantCode` (auto = code), `active`, `logo`, `workspace`, `features` |
| `User.js` | users | `username` (unique), `password` (plaintext!), `role`, `companyCode`, `tenantId`, `active` |
| `SuperAdmin.js` | superadmins | `username` (unique), `password` (plaintext!), `role="superadmin"` |
| `Role.js` | roles | `name` (unique), `label`, `level`, `companyCode` |
| `Permission.js` | permissions | `roleName` (unique), `permissions[]` |
| `ActivityLog.js` | activitylogs | `companyCode`, `action`, `resource`, `userId`, `userName` |
| `Barang.js`, `Kategori.js`, `Satuan.js`, `Warehouse.js`, `Supplier.js`, `Customer.js`, `Rak.js`, `Sales.js`, `BarangGudang.js` | masing-masing | `companyCode` + `kode` (index unique gabungan) |
| `Pembelian.js`, `Penjualan.js`, `Transfer.js`, `StockOpname.js`, `ReturPembelian.js`, `ReturPenjualan.js` | masing-masing | `companyCode` + `nomor` (unique gabungan), `items[]` sub-document, status lifecycle |

**Repository:** Server memakai **Mongoose models langsung di dalam route** (bukan `BaseRepository`). Abstraksi `@smart/data` (`BaseRepository`, `InMemoryRepository`, `Repository`, `db-facade`) ada di framework tapi dipakai untuk layer data client/fallback, bukan oleh Express server. → Bukti: `packages/smart-data/src/base-repository.js`, `apps/inventory/server/routes/*.js` (import model langsung).

**Fallback client:** `apps/inventory/src/data/*` menyimpan seed array lokal sebagai fallback ketika API tidak tersedia (pola `apiCreateFallback` dsb di `packages/smart-api/src/fallback.js`).

**Relationship:** Tidak ada relasi formal (NoSQL). Relasi implisit via `companyCode` (dokumen → company) dan `roleName` (Permission → Role). Index unik gabungan `companyCode+kode/nomor` membuktikan pola ini. → Bukti: `models/Penjualan.js` `schema.index({ companyCode: 1, nomor: 1 }, { unique: true })`.

**Seed (`server/seed.js`):** COMPANY_SEED, USER_SEED, SUPERADMIN_SEED (`superadmin/superadmin123`), ROLE_TEMPLATES, PERMISSION seed, KATEGORI/SATUAN/WAREHOUSE/CUSTOMER/BARANG_SEED, ActivityLog seeding dari koleksi Barang.

---

## 7. API

**Base URL:** `/api` → Express `127.0.0.1:3001` (nginx proxy). Semua route dimount di `apps/inventory/server/index.js`.

### Authentication
| Method & Path | Keterangan |
|---|---|
| `POST /api/auth/login` | Login user (username/email + password) → user JSON |
| `POST /api/auth/forgot-password` | Kirim link reset via email |
| `POST /api/auth/reset-password` | Reset password dengan token |
| `POST /api/auth/register` | Registrasi company + admin owner |
| `GET /api/auth/register/code` | Preview auto-generate company code |
| `POST /api/auth/google` | Login/auto-register via Google userinfo |
| `POST /api/superadmins/login` | Login Super Admin |

### Company
| `GET/POST /api/companies`, `GET/PUT/DELETE /api/companies/:id` | CRUD company (POST/PUT juga bisa buat/update admin user) |

### User / Role / Permission
| `GET/POST /api/users`, `GET/PUT/DELETE /api/users/:id` | CRUD user |
| `GET/POST /api/roles`, `GET/PUT/DELETE /api/roles/:id` | CRUD role |
| `GET /api/permissions/roles`, `GET /api/permissions/roles/:roleName`, `POST /api/permissions/grant`, `POST /api/permissions/revoke` | Manajemen permission per role |
| `GET/POST/PUT/DELETE /api/superadmins` | CRUD Super Admin |

### Inventory (business)
| `GET/POST .../barang`, `/kategori`, `/satuan`, `/warehouse`, `/supplier`, `/customer`, `/rak`, `/sales`, `/barang-gudang` | Master data (masing-masing + `GET /check-kode/:kode`) |
| `GET/POST/PUT/DELETE /api/pembelian`, `/penjualan`, `/transfer`, `/retur-pembelian`, `/retur-penjualan`, `/stock-opname` | Transaksi + `PATCH /:id/status` (lifecycle) |
| `GET /api/stock-opname/barang-stock`, `POST /api/stock-opname/:id/reconcile` | Stok opname |
| `GET /api/inventory-monitoring/stats`, `/by-warehouse`, `/low-stock`, `/out-of-stock`, `/recent-movement`, `/stock-value` | Monitoring stok |
| `GET /api/laporan/stock`, `/purchase`, `/sales`, `/inventory-value`, `/mutation`, `/supplier`, `/customer`, `/labarugi`, `/piutang` | Laporan |

### System / Platform
| `GET /api/health` | Health check |
| `GET /api/activity` | Activity log (pagination) |
| `GET/POST/DELETE /api/platform/logo` | Logo platform (file-based) |
| `GET/POST/DELETE /api/platform/app-logo/:slug` | Logo per aplikasi |
| `GET /api/wilayah/provinces`, `/:prov/regencies`, `/:prov/:kab/districts`, `/:prov/:kab/:kec/villages`, `POST /api/wilayah/refresh` | Wilayah Indonesia |

### Yang TIDAK ADA (dicari, tidak ditemukan)
- **Subscription / License / Billing / Invoice / Payment / Package** → 0 match di `apps/inventory/server`.
- **Monitoring infrastruktur** (CPU/RAM/disk/PM2/Mongo/Redis) → tidak ada endpoint.
- **Deployment API** → tidak ada endpoint (hanya script shell).
- **Log viewer API** (selain activity log) → tidak ada.

---

## 8. AUTHENTICATION

| Aspek | Temuan | Bukti |
|---|---|---|
| **Login user** | `POST /api/auth/login` — validasi username/email + password terhadap koleksi `users`, memblokir company non-aktif. **Password dibandingkan plaintext** (`user.password !== password`). Tidak ada hashing (tidak ada bcrypt di dependencies). | `apps/inventory/server/routes/auth.js`; `apps/inventory/server/package.json` |
| **Login Super Admin** | `POST /api/superadmins/login` — koleksi terpisah `superadmins`, password plaintext. | `apps/inventory/server/routes/superadmins.js` |
| **Logout** | Hanya client-side: `Auth.logout()` membersihkan state + token in-memory. Tidak ada endpoint logout / invalidasi server. | `packages/smart-core/src/auth/auth.js`; `apps/inventory/src/main.js handleLogout()` |
| **Session** | Dua lapis: (1) `Auth` in-memory (`packages/smart-core/src/auth/session.js` — Map, token `smt_` + 32 hex random, TTL 24 jam, **hilang saat refresh**); (2) `SMART.Session` global yang persist via `companySession`/storage dan bisa `restore()`. Impersonasi dipersist ke `sessionStorage` agar tahan reload. | `packages/smart-core/src/session/index.js`, `packages/smart-core/src/company/company-session.js`, `apps/inventory/src/main.js` |
| **JWT** | **TIDAK ADA.** Tidak ada `jsonwebtoken`; server tidak mengeluarkan token apa pun saat login (hanya objek user). Interceptor `Authorization: Bearer` ada di `@smart/api` tapi server tidak pernah memvalidasinya. | `apps/inventory/server/package.json`; `packages/smart-api/src/interceptors/auth.js`; `routes/auth.js` |
| **Firebase** | **TIDAK ADA** integrasi Firebase di kode (hanya disebut sebagai analogi di dokumen SP-004/SP-003). | `grep firebase` → hanya `docs/*` |
| **Mongo** | Ya — kredensial user & superadmin di MongoDB; validasi server-side via Mongoose. | `models/User.js`, `models/SuperAdmin.js` |
| **Cookie** | **TIDAK ADA** — tidak ada cookie session/httpOnly. CORS `credentials: true` namun tidak digunakan untuk session. | `apps/inventory/server/index.js` (cors) |
| **Token (reset password)** | Token random disimpan plaintext di kolom `resetToken` + `resetTokenExpiry` (1 jam) pada User/SuperAdmin. | `routes/auth.js`, `services/email.js` |
| **Refresh token** | **TIDAK ADA.** | grep — 0 match |
| **Super Admin** | Role `superadmin` (level 200, wildcard `*`) di `packages/smart-core/src/permission/roles.js`; akun seed `superadmin/superadmin123`. **Pemisahan UI/login sudah ada, tapi pengecekan role superadmin di client saja** (`Auth.user()?.role === "superadmin"`). | `server/seed.js`; `apps/inventory/src/main.js` |
| **Company Admin** | Konsep: owner/admin perusahaan (role `owner`, `admin`) yang dibuat saat registrasi. Impersonasi `Login As` mensimulasikan Company Admin (`userId: companyCode + "-admin", role: "owner"`). Tidak ada mekanisme auth terpisah untuk Company Admin di server. | `routes/register.js`; `dashboard.js startImpersonation()` |
| **User** | User perusahaan dengan `companyCode`; menu & route difilter client-side oleh `Permission.can()`. | `apps/inventory/src/config/menu.js`, `router/routes.js` |
| **Google** | Client OAuth2 → ambil info dari `googleapis.com/oauth2/v3/userinfo` → kirim ke `POST /api/auth/google`. **Server tidak memverifikasi token** (komentar di kode: "sudah diverifikasi oleh Google userinfo API via HTTPS"). | `routes/auth-google.js` |

**Kesimpulan Auth:** Autentikasi berfungsi secara fungsional, tetapi **tidak aman untuk produksi multi-tenant**: password plaintext, tanpa JWT/session server, tanpa otorisasi per-route, pengecekan role di client. Ini kandidat refactor prioritas tinggi (lihat §15).

---

## 9. MULTI TENANT

**Jawaban: BUKAN true multi-tenant (shared-database / company-scoped, enforced sebagian).**

| Konsep | Implementasi | Bukti |
|---|---|---|
| **company / tenant** | Satu database Mongo bersama (`smart_inventory`); setiap dokumen memiliki `companyCode` (dan `tenantId`/`tenantCode` pada Company/User/Role/Permission, auto = code). Isolasi = filter query per `companyCode`. | `models/Company.js` (`pre("save")` set tenantId), `routes/barang.js` (`x-company-code`) |
| **institution** | `Institution.current()` dari `@smart/core` menentukan nama institusi & workspace; di-set dari `companyCode` user. | `packages/smart-core/src/institution/institution.js`; `apps/inventory/src/main.js` |
| **workspace** | Workspace statis (`default`, `corporate`, `warehouse`) di `packages/smart-ui/src/workspaces/`; dipilih via `Institution.current().workspace` lalu `loadWorkspace()`. Bukan per-tenant dinamis. | `packages/smart-ui/src/workspaces/engine.js`; `apps/inventory/src/main.js` |
| **organization** | Tidak ada entitas organization terpisah; yang ada hanya Company. | grep — 0 match relevan |
| **database (per-tenant)** | **TIDAK ADA** database per-tenant. | `db.js` (satu URI) |
| **domain / subdomain** | Routing domain di Nginx statis (`master.e-profit.id`, `inv.e-profit.id` → build yang sama). Deteksi subdomain dilakukan **client-side** (`getAppMode()`), bukan server-side tenant resolution. | `platform/config/nginx/*.conf`; `apps/inventory/src/main.js` |
| **Header isolasi** | Client mengirim `x-company-code` (dari `SMART.Session`) dan `x-user-name`. Server **menerima header opsional** — bila tidak ada, query tidak di-filter (`if (!companyCode) return true; // no company filter = allow`). | `apps/inventory/src/data/api.js`, `packages/smart-api/src/fallback.js`, `routes/barang.js` |
| **Enforcement** | **TIDAK ada otorisasi yang mengikat header ke user yang login** (tidak ada middleware auth). Siapa pun yang tahu `x-company-code` bisa memintanya. | `apps/inventory/server/index.js` (tidak ada middleware auth global) |
| **Impersonation lintas tenant** | Super Admin bisa masuk sebagai admin perusahaan mana pun via `impersonation.start()` + restore `sessionStorage`. | `packages/smart-core/src/impersonation/index.js`, `apps/inventory/src/main.js` |

**Kesimpulan Multi-Tenant:** Modelnya *shared database + companyCode scoping* (sama seperti SP-012 yang mendeskripsikan Shared Database/Pooled Model). **Bukan multi-tenant penuh** karena: (1) tidak ada auth yang mengikat konteks tenant, (2) header isolasi opsional, (3) mapping company↔app tidak persist. Kandidat perbaikan prioritas tinggi.

---

## 10. PROVISIONING

| Proses | Status | Alur / Bukti |
|---|---|---|
| **Create Company** | ✅ ADA (2 jalur) | (1) Super Admin: `POST /api/companies` — buat company + opsional admin user (`routes/companies.js`, form "Tambah Perusahaan" di `dashboard.js`). (2) Self-service: `POST /api/auth/register` — auto-generate kode company (`PT-001` dst, atau `BUMDes-<desaCode>`), retry saat kode duplikat (`routes/register.js`). |
| **Create Database** | ❌ TIDAK ADA | Satu DB bersama `smart_inventory` (`db.js`). Tidak ada provisioning database per tenant. |
| **Create User** | ✅ ADA | `POST /api/users` (user perusahaan), `POST /api/superadmins` (platform user), auto-create saat registrasi (`routes/register.js`) dan saat create/edit company (`routes/companies.js`). |
| **Create License** | ❌ TIDAK ADA | Hanya stub `license()` di `facade.js`. Tidak ada model/rute license. |
| **Create Package** | ❌ TIDAK ADA | Tidak ada konsep package/billing (grep server → 0 match). |
| **Create Workspace** | ❌ TIDAK ADA (statis) | Workspace adalah file statis `packages/smart-ui/src/workspaces/{default,corporate,warehouse}/workspace.json`. Tidak ada provisioning dinamis. |
| **Create Domain** | ❌ TIDAK ADA (manual) | Domain dikonfigurasi manual via Nginx (`platform/config/nginx/*.conf`, template `app-template.conf`) + Certbot. Tidak ada modul/API. |
| **Create Application** | ❌ TIDAK ADA (hardcoded) | Registry `BUILTIN_APPS` hardcoded di `packages/smart-core/src/platform/index.js`. Tidak ada CRUD aplikasi. |

**Kesimpulan Provisioning:** Hanya **Create Company + Create User** yang ada (dan itupun mapping company↔app tidak persist ke database). Semua provisioning lain (database, license, package, workspace, domain, application) **belum ada** — sesuai status draft SP-027.

---

## 11. MONITORING

| Aspek | Temuan | Bukti |
|---|---|---|
| **Dashboard monitoring** | **TIDAK ADA** dashboard monitoring infrastruktur. SP-027 #6/#9 (CPU, Memory, Disk, Network, PM2, MongoDB, Redis, Uptime) — tidak ditemukan implementasi. | `docs/SP-027 — SMART CONSOLE FOUNDATION` vs isi `apps/` & `packages/` |
| **Health** | `GET /api/health` → `{status:'ok'}`; script `platform/scripts/health-check.sh` (cek process/port/disk sederhana). | `apps/inventory/server/index.js`; `platform/scripts/health-check.sh` |
| **Server / CPU / Memory / Storage** | Tidak ada endpoint. Artefak: `platform/monitoring/server-info.txt` (output `bootstrap.sh` — model CPU, RAM, dst). | `platform/bootstrap/bootstrap.sh`; `platform/monitoring/server-info.txt` |
| **Worker / Queue / Scheduler** | **TIDAK ADA** (tidak ada bull/queue/cron di dependencies). | `apps/inventory/server/package.json` |
| **Mongo / Redis** | Mongo: tidak ada dashboard (hanya koneksi). Redis: **TIDAK ADA** (tidak ada dependency). | `apps/inventory/server/package.json` |
| **Log** | Log Nginx per-domain di `/srv/logs/*.log` (konfigurasi, bukan viewer). Tidak ada log viewer UI. | `platform/config/nginx/master.e-profit.id.conf` |
| **Audit** | (a) Audit platform client-side in-memory (`packages/smart-core/src/audit/index.js`). (b) Activity log server (`models/ActivityLog.js`, `GET /api/activity`). Keduanya terpisah; audit platform tidak persist. | lihat kode masing-masing |
| **Monitoring bisnis inventory** | `routes/inventory-monitoring.js` (stats, by-warehouse, low-stock, out-of-stock, recent-movement, stock-value) + tab "📊 Stock Monitoring" di `apps/inventory/src/pages/inventory/index.js`. | kode tersebut |

**Kesimpulan Monitoring:** Monitoring infrastruktur yang disyaratkan SP-027 **belum ada sama sekali**; yang ada hanya health check, activity log bisnis, dan monitoring stok inventory.

---

## 12. BILLING

| Aspek | Temuan | Bukti |
|---|---|---|
| **Subscription** | **STUB client-only.** `platform.enableAppForCompany/disableAppForCompany` di `packages/smart-core/src/platform/index.js` — array in-memory `_companyApps`, hilang saat reload, tidak pernah disimpan ke Mongo. UI toggle "📋 Subs" di `dashboard.js` hanya memanggil fungsi in-memory ini. `SMART.Platform.subscription()` hanya membungkus `hasAccess()`. | `packages/smart-core/src/platform/index.js`; `packages/smart-core/src/facade.js`; `packages/smart-ui/src/modules/platform/dashboard.js` (`manageSubscription`) |
| **Invoice** | **TIDAK ADA** (billing). Catatan: "invoice" yang ada adalah invoice bisnis Inventory (SO/SJ/Kwitansi) — bukan billing SaaS. | `routes/penjualan.js` (status `invoiced`) |
| **Payment** | **TIDAK ADA.** Tidak ada payment gateway/provider. | `apps/inventory/server/package.json`; grep server |
| **Package** | **TIDAK ADA** (tidak ada konsep paket/tier; field `tier` hanya komentar JSDoc di `platform/index.js`). | `packages/smart-core/src/platform/index.js` |
| **Renewal / Upgrade / Downgrade / Trial / Expired** | **TIDAK ADA** semuanya. | grep — 0 match |
| **Dokumentasi** | Arsitektur billing hanya berupa dokumen desain `docs/SP-022-BILLING-SUBSCRIPTION-ARCHITECTURE.md` (belum diimplementasikan). | dokumen tersebut |

**Kesimpulan Billing:** Tidak ada billing/subscription yang berfungsi. Yang ada hanya simulasi in-memory di client dan desain dokumen. Kebutuhan untuk transformasi SMART Console: **harus dibangun dari nol**.

---

## 13. DEPENDENCY MAP

**Lapisan runtime (berdasarkan import di kode):**

```
apps/inventory (Vite SPA)
  ├── @smart/core      (SMART facade: Session, Company, Permission, Platform, Audit, Impersonation)
  ├── @smart/ui        (UI facade: UI, loadUI, showToast; layouts; workspaces; modules platform/settings/auth)
  ├── @smart/inventory-ui (modul bisnis: dashboard, barang, pembelian, penjualan, transfer, laporan)
  ├── @smart/api       (API facade: API, fallback helpers)
  └── @smart/data      (DB facade: DB, BaseRepository, state, cache, pagination)
        │
        ▼ (fetch /api/*)
apps/inventory/server (Express 3001)
  ├── mongoose (MongoDB: 21 model)
  ├── services/email.js (resend + nodemailer)
  └── nginx /api → 127.0.0.1:3001
```

**Dependency fungsional (konseptual, berdasar kode):**

```
Platform Dashboard (dashboard.js)
  ├── platform manager (@smart/core/platform) → Application registry (BUILTIN_APPS)
  │     └── company↔app mapping (IN-MEMORY, tidak persist) → SUBSCRIPTION (stub)
  ├── Company CRUD (routes/companies.js + models/Company.js + models/User.js)
  ├── SuperAdmin CRUD (routes/superadmins.js + models/SuperAdmin.js)
  ├── Impersonation (@smart/core/impersonation) → SMART.Session / sessionStorage
  └── Audit (@smart/core/audit) → in-memory

Auth (routes/auth.js) → User / SuperAdmin / Company → login → Auth.currentUser (client)
Registration (routes/register.js) → Company + User (role owner)
Permission (routes/permissions.js + @smart/core/permission) → Permission.syncFromServer()
Inventory business → semua model + route → activity log
```

**Titik lemah dependency:** `dashboard.js` (platform/console) bergantung pada `apps/inventory` (data services via DI + API `/api/platform/*` dan `/api/companies`) — artinya **console tidak mandiri dari Inventory**, melanggar golden rule SP-027 #14 ("Console tidak boleh tergantung Inventory"). → Bukti: `apps/inventory/src/pages/platform/index.js` meng-inject `listCompanies` dsb dari `apps/inventory/src/data/index.js`; `dashboard.js` memanggil `fetch('/api/platform/...')` langsung.

---

## 14. SMART PLATFORM MAPPING

| Kelompok | Kode | Penilaian |
|---|---|---|
| **A. SMART Console** | Saat ini **tidak ada `apps/console`**. Yang ada: modul platform di `packages/smart-ui/src/modules/platform/` + wrapper `apps/inventory/src/pages/platform/` + `pages/superadmin-login/` + hostname routing di `apps/inventory/src/main.js` | **Harus dipisah**: UI konsol sudah tersedia sebagai modul reusable (`PlatformDashboardModule`, `SuperAdminLoginPage`), tinggal di-extract menjadi app mandiri `apps/console` sesuai SP-027 (apps/console) dengan data services & API console sendiri. |
| **B. SMART Framework (@smart/core)** | Auth, Session, Company, Permission, Platform manager, Impersonation, Audit | **Sudah sesuai** (sebagian besar). Catatan: `auth.js` masih memuat demo user hardcoded (admin/operator) → **harus dibersihkan**; `facade.js` berisi stub `license()` → hapus/tangguhkan sampai billing ada. |
| **C. SMART UI (@smart/ui)** | Tokens, components, layouts, workspaces, modules/settings, modules/auth, modules/platform, modules/master-crud | **Sebagian sesuai, sebagian harus dipindah**: `modules/platform/` (dashboard + login) adalah modul **console** → pindah ke `apps/console` (jangan di framework). `modules/settings` & `modules/auth` → tetap di framework (dipakai banyak app). |
| **D. SMART API (@smart/api)** | client, interceptors, fallback, error, resources | **Sudah sesuai** — framework-level, tidak ada business logic. |
| **E. SMART Data (@smart/data)** | BaseRepository, InMemoryRepository, Repository, state, cache, pagination, persistence, mongodb, db-facade | **Sudah sesuai** — framework-level. Catatan: server Express tidak memakai lapisan ini (langsung Mongoose) → potensi penyatuan (MEDIUM). |
| **F. Business Domain** | `@smart/inventory-ui` + `apps/inventory` (client data + server) | **Sudah sesuai**: Inventory sudah di-extract ke domain package `@smart/inventory-ui` (SP-025/SP-026). Accounting/POS/CRM/HR: hanya entri registry (`active:false`) → **belum ada kode** (UNKNOWN untuk status implementasi; yang ada hanya registry + dokumen). |
| Lainnya | `apps/smartvindo` (situs marketing), `apps/_template` (template), `platform/` (infra), `shared/data/wilayah.json` | **Harus tetap** di posisinya (bukan bagian console). |

---

## 15. REFACTORING CANDIDATE

> Daftar ini HANYA rekomendasi — tidak ada kode yang diubah.

### HIGH PRIORITY
1. **Extract SMART Console menjadi `apps/console` mandiri** — pisahkan dari `apps/inventory` (hostname routing `getAppMode()`, `pages/platform/`, `pages/superadmin-login/`). Console tidak boleh import domain package & tidak boleh bergantung pada Inventory (SP-027 #14). Bukti: `apps/inventory/src/main.js`, `apps/inventory/src/pages/platform/index.js`.
2. **Auth server-side yang aman** — hash password (bcrypt/argon2), token/JWT atau session server, middleware otorisasi per-route, logout/invalidasi. Bukti: `models/User.js`, `models/SuperAdmin.js` (password plaintext), `routes/*.js` (tanpa middleware).
3. **Enforce multi-tenant di server** — ikat `x-company-code` ke user yang login; jangan izinkan "no company filter = allow". Bukti: `routes/barang.js`.
4. **Persist subscription/company-app mapping** — pindahkan `_companyApps` dari memori ke MongoDB (collection baru). Bukti: `packages/smart-core/src/platform/index.js`.
5. **Buat baseline monitoring infrastruktur** (health endpoint lengkap + dashboard) agar SP-027 #6/#9 terpenuhi. Bukti: `docs/SP-027`.

### MEDIUM
6. **Hapus demo user hardcoded** (`users = {admin, operator}`) dari `packages/smart-core/src/auth/auth.js` dan hapus stub `license()` di `facade.js`.
7. **Pindahkan `modules/platform/*` dari `@smart/ui`** ke `apps/console` (atau package console tersendiri).
8. **Pindahkan data services platform** (`listCompanies`, `superadmin-data`) keluar dari `apps/inventory/src/data` ke console.
9. **Penyatuan layer data** — server masih memakai Mongoose langsung; pertimbangkan memakai `@smart/data` repository abstraction secara konsisten.
10. **Bersihkan dual auth** — `Auth.login()` lokal vs `apiLogin`; satu jalur otentikasi yang jelas.

### LOW
11. **Hapus export deprecated** (`@deprecated` exports di `@smart/core`, `@smart/ui`, `@smart/api`, `@smart/data`) setelah semua konsumen migrasi ke facade `SMART.*`/`UI.*`/`API.*`/`DB.*`.
12. **Konsolidasi konfigurasi Nginx** (duplikasi `master`/`inv` config hampir identik; pemisahan SSL cert file master dipakai juga oleh inv). Bukti: `platform/config/nginx/*.conf`.
13. **Rapikan fallback data lokal** di `apps/inventory/src/data/*` (duplikasi seed di client vs server).
14. **Hapus kode UNUSED** (contoh: `CrudModule` vs wrapper spesifik; `platform.getWorkspace` dll yang tidak terpakai) — verifikasi dulu pemakaiannya (UNKNOWN untuk beberapa).

---

## 16. MIGRATION READINESS

**Apakah master.e-profit.id layak dijadikan SMART Console?**

**TIDAK — belum layak secara langsung**, tetapi **fondasinya layak dikembangkan**.

**Alasan (berdasar kode):**
- `master.e-profit.id` saat ini hanyalah **hostname routing menuju aplikasi Inventory** dalam mode platform (`apps/inventory/src/main.js getAppMode()`), bukan aplikasi mandiri `apps/console`. Melanggar kriteria sukses SP-027: "✓ Console dapat dijalankan sendiri", "✓ Tidak tergantung Inventory".
- Tidak ada: auth server-side aman, otorisasi per-route, billing/subscription persist, monitoring infrastruktur, database manager, log viewer, AI monitoring, multi-role console.

**Persentase kesiapan: ±35%** (estimasi berdasarkan porsi modul SP-027 yang sudah ada).

| Komponen SP-027 | Status kode |
|---|---|
| Dashboard (super admin, app grid, company) | ✅ Ada (`packages/smart-ui/src/modules/platform/dashboard.js`) |
| Applications manager | 🟡 Parsial (registry hardcoded, tanpa deploy/restart/version) |
| Services manager | ❌ Tidak ada |
| Users (platform) | ✅ Ada (CRUD superadmin) |
| Permission | 🟡 Client-side saja (belum enforced di server) |
| Logs viewer | ❌ Tidak ada (hanya activity log bisnis) |
| Monitoring | ❌ Tidak ada (hanya health + monitoring bisnis) |
| Database manager | ❌ Tidak ada |
| AI | ❌ Tidak ada |
| Settings | ✅ Ada (logo platform & app) |
| Authentication | 🟡 Ada tapi tidak aman (plaintext, client-only) |
| Workspace | 🟡 Statis (default/corporate/warehouse) |

**Yang kurang (checklist menuju SMART Console):**
1. Buat `apps/console` mandiri + pindahkan modul platform & data services.
2. Auth server-side aman + otorisasi per-route (JWT/session, hash password).
3. Enforce multi-tenant di server.
4. Subscription & billing persist (collection baru + modul billing sesuai SP-022).
5. Monitoring infrastruktur (CPU/RAM/disk/PM2/Mongo/Redis) + log viewer + health per-app.
6. Database manager read-only, services manager, AI monitoring (sesuai roadmap SP-027 #10–12).
7. Multi-role console (Super Admin / Developer / Operator / Readonly) — SP-027 #13.
8. Provisioning domain/workspace/application yang otomatis (saat ini manual/hardcoded).

---

## LAMPIRAN — DAFTAR BUKTI KUNCI

| Topik | File |
|---|---|
| Routing domain → build inventory | `platform/config/nginx/master.e-profit.id.conf`, `inv.e-profit.id.conf` |
| Deteksi mode platform by hostname | `apps/inventory/src/main.js` (`getAppMode`, `showPlatformDashboard`, `showSuperAdminLogin`) |
| UI console | `packages/smart-ui/src/modules/platform/dashboard.js`, `login.js` |
| Wrapper console | `apps/inventory/src/pages/platform/index.js`, `pages/superadmin-login/`, `data/superadmin-data.js` |
| Server API (30 route) | `apps/inventory/server/index.js` + `routes/*.js` |
| Database | `apps/inventory/server/db.js`, `models/*.js` (21), `seed.js` |
| Auth & keamanan | `routes/auth.js`, `routes/superadmins.js`, `models/User.js`, `models/SuperAdmin.js`, `packages/smart-core/src/auth/*` |
| Multi-tenant | `packages/smart-core/src/company/*`, `packages/smart-data/src/base-repository.js`, `routes/barang.js` |
| Subscription/license stub | `packages/smart-core/src/platform/index.js`, `facade.js`, `dashboard.js manageSubscription()` |
| Email | `apps/inventory/server/services/email.js` |
| SP-027 target | `docs/SP-027 — SMART CONSOLE FOUNDATION` |
| Sejarah implementasi | `docs/execution_status.md` |

---
*Dokumen ini murni hasil investigasi read-only. Tidak ada file kode yang diubah, ditambah, dihapus, atau di-refactor.*
