# SP-027 — MILESTONE 0: PLATFORM FOUNDATION VERIFICATION

> **Mode:** READ ONLY — tanpa perubahan kode, refactor, maupun commit.
> **Tanggal:** 2026-08-05
> **Branch:** `epic-002-inventory`
> **Auditor:** Principal Software Architect / Software Auditor / Lead Platform Engineer
> **Metode:** Verifikasi kode langsung + build/test aktual + config produksi (nginx aktif). Setiap kesimpulan menyertakan path bukti.

---

## 1. EXECUTIVE SUMMARY

Migrasi SMART Console (SP-027 Phase 1) dinyatakan **BERSIH SECARA ARSITEKTUR** untuk seluruh
Golden Rule Phase 1:

| Golden Rule | Status | Bukti |
|---|---|---|
| Console tidak bergantung pada Inventory | ✅ PASS | `apps/console/package.json` hanya depend `@smart/core`, `@smart/ui`, `@smart/api`, `@smart/data`. Nol import `@smart/inventory-ui` / path inventory. |
| Inventory tidak memiliki Platform Dashboard | ✅ PASS | `apps/inventory/src/config/menu.js` tidak ada entri platform/superadmin; `apps/inventory/src/main.js` hanya melayani Inventory. |
| Platform Module hanya di `apps/console` | ✅ PASS | `apps/console/src/modules/platform/` (login + dashboard). `packages/smart-ui/src/modules/platform/` sudah dihapus. |
| Business Module hanya di `@smart/inventory-ui` | ✅ PASS | `packages/smart-inventory-ui/src/modules/`: barang, dashboard, laporan, pembelian, penjualan, transfer. |
| Framework tetap bersih | ✅ PASS | `@smart/core|ui|api|data` tidak mengandung business logic inventory/console (PlatformManager = concern framework). |
| Routing sesuai arsitektur | ✅ PASS | nginx: `master.e-profit.id` → `/srv/apps/console/dist`; `inv.e-profit.id` → `/srv/apps/inventory/dist`. Terverifikasi di `/etc/nginx/sites-enabled/`. |
| Build & Test berhasil | ✅ PASS | console 634ms, inventory 849ms; **509/509 test pass**. |

**Temuan yang TIDAK menghalangi GO (dicatat sebagai utang):**

1. **CRITICAL (pra-eksisting):** Autentikasi server membandingkan **password plaintext** tanpa hashing
   (`apps/inventory/server/routes/auth.js`, `routes/superadmins.js`; tidak ada bcrypt di seluruh server).
2. **CRITICAL (pra-eksisting):** Kredensial default hardcoded di seed
   (`apps/inventory/server/seed.js`: `admin/admin123`, `superadmin/superadmin123`).
3. **HIGH (pra-eksisting):** Tidak ada JWT/session server; otorisasi hanya client-side (RBAC in-memory).
4. **MEDIUM:** Console secara **runtime** memakai API yang di-host di `apps/inventory/server`
   (backend bersama, port 3001). Bukan dependency source-code, tapi coupling deployment —
   kandidat pemisahan backend pada milestone berikutnya.
5. **LOW:** `40` error lint semuanya `no-undef` (browser-global: `document`, `FileReader`, `google`,
   dll) — utang konfigurasi eslint, bukan dari migrasi.

**Keputusan:** **GO** untuk melanjutkan implementasi SP-027, dengan syarat item security
(plaintext password, seed credential) masuk sprint perbaikan pertama.

---

## 2. ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            SMART PLATFORM                                │
│                                                                          │
│  ┌───────────────────────┐          ┌──────────────────────────────┐    │
│  │  master.e-profit.id   │          │      inv.e-profit.id         │    │
│  │  ┌─────────────────┐  │          │  ┌────────────────────────┐  │    │
│  │  │   apps/console  │  │          │  │   apps/inventory       │  │    │
│  │  │   SMART Console │  │          │  │   SMART Inventory      │  │    │
│  │  │   (Super Admin) │  │          │  └───────────┬────────────┘  │    │
│  │  └────────┬────────┘  │          │              │               │    │
│  └───────────┼───────────┘          └──────────────┼───────────────┘    │
│              │                                    │                     │
│              └──────────────┬─────────────────────┘                     │
│                             ▼                                           │
│              ┌──────────────────────────────┐                           │
│              │  nginx (master→console/dist, │                           │
│              │        inv→inventory/dist)   │                           │
│              └──────────────┬───────────────┘                           │
│                             │ /api/ (proxy)                             │
│                             ▼                                           │
│              ┌──────────────────────────────┐                           │
│              │  Express API (127.0.0.1:3001)│  ⚠ backend bersama        │
│              │  apps/inventory/server       │  (catatan MEDIUM)         │
│              └──────────────┬───────────────┘                           │
│                             ▼                                           │
│                    ┌──────────────────┐                                 │
│                    │   MongoDB        │                                 │
│                    └──────────────────┘                                 │
└─────────────────────────────────────────────────────────────────────────┘

Framework (dipakai kedua app):
  @smart/core  @smart/ui  @smart/api  @smart/data  (4 framework package)
Business Domain:
  @smart/inventory-ui  (barang, dashboard, laporan, pembelian, penjualan, transfer)
```

---

## 3. DEPENDENCY DIAGRAM

```
apps/console ──────────────► @smart/core
      │                     @smart/ui
      │                     @smart/api
      │                     @smart/data
      │
      └── ✗ TIDAK ADA ──► apps/inventory
      └── ✗ TIDAK ADA ──► @smart/inventory-ui

apps/inventory ────────────► @smart/core
      │                     @smart/ui
      │                     @smart/data
      ├───────────────────► @smart/inventory-ui   (business modules)
      │
      └── ✗ TIDAK ADA ──► apps/console

@smart/inventory-ui ───────► @smart/ui
                             @smart/core
```

**Bukti imports `apps/console`** (`apps/console/src/**`):
- `main.js:12-13` — `@smart/core`, `@smart/ui`
- `modules/platform/dashboard.js:12-13` — `@smart/core`, `@smart/ui`
- `services/*` — murni `fetch()` relatif `/api/*`, tanpa import package eksternal
- Nol kemunculan `@smart/inventory-ui` atau `apps/inventory` di seluruh `apps/console/src` (grep: 0 match import).

---

## 4. ROUTING DIAGRAM

```
master.e-profit.id (443, SSL)
  └─ root /srv/apps/console/dist            [platform/config/nginx/master.e-profit.id.conf:10]
     └─ / → try_files … /index.html (SPA)   [master.conf:14]
     └─ /api/ → proxy_pass 127.0.0.1:3001   [master.conf:24]
  └─ http:80 → 301 https                    [master.conf:52]

inv.e-profit.id (443, SSL)
  └─ root /srv/apps/inventory/dist          [platform/config/nginx/inv.e-profit.id.conf:9]
     └─ / → try_files … /index.html (SPA)   [inv.conf:13]
     └─ /api/ → proxy_pass 127.0.0.1:3001   [inv.conf:23]
  └─ http:80 → 301 https                    [inv.conf:51]
```

**Terverifikasi aktif di produksi** (`/etc/nginx/sites-enabled/master.e-profit.id.conf` & `inv.e-profit.id.conf`):
- master → `root /srv/apps/console/dist` ✅
- inv → `root /srv/apps/inventory/dist` ✅
- Tidak ada cross-routing. ✅

---

## 5. PACKAGE DEPENDENCY MATRIX

| Package | core | ui | api | data | inventory-ui | config |
|---|---|---|---|---|---|---|
| `@smart/core` | — | ✗ | ✗ | ✗ | ✗ | ✗ |
| `@smart/ui` | ✅ | — | ✗ | ✗ | ✗ | ✗ |
| `@smart/api` | ✅ | ✗ | — | ✗ | ✗ | ✗ |
| `@smart/data` | ✅ | ✗ | ✗ | — | ✗ | ✗ |
| `@smart/inventory-ui` | ✅ | ✅ | ✗ | ✗ | — | ✗ |
| `@smart/config` | ✗ | ✗ | ✗ | ✗ | ✗ | — |

## 6. APPLICATION DEPENDENCY MATRIX

| App | @smart/core | @smart/ui | @smart/api | @smart/data | @smart/inventory-ui | apps/console | apps/inventory |
|---|---|---|---|---|---|---|---|
| `apps/console` | ✅ | ✅ | ✅ | ✅ | ✗ | — | ✗ |
| `apps/inventory` | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | — |

**Kesimpulan:** Tidak ada dependency silang antar aplikasi. ✅

---

## 7. VIOLATION REPORT

### CRITICAL (harus ditangani sebelum produksi skala besar)

| # | Violation | Bukti | Catatan |
|---|---|---|---|
| C1 | **Password disimpan & dibandingkan plaintext** — tanpa hashing (bcrypt/argon2) | `apps/inventory/server/routes/auth.js` (`user.password === password`), `apps/inventory/server/routes/superadmins.js`; grep bcrypt: 0 hasil | Pra-eksisting, di luar scope migrasi Phase 1 |
| C2 | **Kredensial default hardcoded di seed** | `apps/inventory/server/seed.js`: `admin/admin123` (L47), `superadmin/superadmin123` (L179) | Pra-eksisting; wajib ganti di env produksi |

### HIGH (pra-eksisting, terkait auth platform)

| # | Violation | Bukti |
|---|---|---|
| H1 | Tidak ada JWT / session server — login hanya set `Auth.currentUser` di memori client | `apps/inventory/server/routes/auth.js`, `routes/superadmins.js`; `packages/smart-core/src/auth/` |
| H2 | Otorisasi per-route API tidak ada (semua endpoint Express tanpa middleware guard) | `apps/inventory/server/routes/*.js` |
| H3 | RBAC hanya client-side (menu/permission in-memory) | `apps/inventory/src/router/index.js`, `apps/inventory/src/config/menu.js` |

### MEDIUM (dari migrasi, perlu perencanaan)

| # | Violation | Bukti |
|---|---|---|
| M1 | **Console bergantung runtime pada API yang di-host di `apps/inventory/server`** (backend bersama port 3001) — bukan dependency source-code, tapi coupling deployment | `platform/config/nginx/master.e-profit.id.conf:24` (proxy 3001); seluruh `apps/console/src/services/*` memakai `/api/...` yang dimount `apps/inventory/server/index.js` |
| M2 | Domain app hardcoded di Console (`getAppEntryUrl`) | `apps/console/src/modules/platform/dashboard.js:170-181` (`inventory: "https://inv.e-profit.id/"`) — sudah ada override `window.__APP_URLS__`, tapi default tetap hardcode |
| M3 | Handoff impersonation via query param URL (masuk access log nginx) | `apps/console/src/modules/platform/dashboard.js:1118-1127` |

### LOW

| # | Violation | Bukti |
|---|---|---|
| L1 | 40 error lint semuanya `no-undef` (browser-global tak terkonfigurasi di eslint) | `npm run lint` — semua error `no-undef` (`document`, `FileReader`, `google`, `Event`, dll) di seluruh repo |
| L2 | `console.log` debug di Console | `apps/console/src/main.js:98,102`, `modules/platform/dashboard.js:1116` |
| L3 | Eslint config tidak memuat `env: { browser: true }` | `eslint.config.js` |

---

## 8. TECHNICAL DEBT

1. **Auth stack lama** — plaintext password, tanpa token/session (C1, C2, H1, H2, H3). Ini blokir utama untuk semua fitur SP-027 berikutnya (Billing, Monitoring, Deployment) yang butuh otorisasi server-side.
2. **Backend tunggal** — Express di `apps/inventory/server` melayani platform + business (M1). Idealnya: `apps/console/server` (platform API) dipisah dari `apps/inventory/server` (business API) sesuai SP-026.
3. **Domain hardcode** — belum ada konfigurasi domain per-app terpusat (M2).
4. **Handoff impersonation** — token one-time via API lebih aman daripada payload di URL (M3).
5. **Eslint config** — global browser tidak dikonfigurasi → 40 error semu (L1, L3).
6. **Komentar JSDoc** di modul console masih menyebut `@smart/ui/modules/platform/*` (sisa dari pemindahan) — kosmetik. (Bukti: `apps/console/src/modules/platform/login.js:8`)

---

## 9. IMPROVEMENT RECOMMENDATION

| Prioritas | Rekomendasi | Milestone |
|---|---|---|
| P0 | Migrasi password ke bcrypt + mekanisme token/session server (C1, C2, H1) | SP-027 sebelum fitur publik |
| P0 | Hapus kredensial seed default dari produksi (env-driven) (C2) | sama |
| P1 | Middleware guard per-route + RBAC server-side (H2, H3) | bersama P0 |
| P1 | Pisah API server Console dari Inventory (M1) — `apps/console/server` | SP-027 Phase 2 |
| P1 | Konfigurasi domain per-app terpusat (M2) — ganti hardcode `getAppEntryUrl` | Phase 2 |
| P2 | Handoff impersonation pakai one-time token via API (M3) | Phase 2/3 |
| P2 | Konfigurasi eslint: `globals.browser` / env browser → bersihkan 40 no-undef (L1, L3) | teknis |
| P3 | Bersihkan `console.log` debug & JSDoc usang (L2, debt #6) | teknis |

---

## 10. ARCHITECTURE READINESS SCORE

| Dimensi | Skor /10 | Alasan |
|---|---|---|
| **Architecture** | 9 | Pemisahan app/framework/business sesuai SP-026 & SP-027; graph bersih |
| **Maintainability** | 7 | Struktur modular rapi; komentar JSDoc usang & hardcode domain kecil |
| **Scalability** | 6 | Backend tunggal & auth client-side membatasi scaling |
| **Modularity** | 9 | Package boundary jelas; platform module terisolasi di console |
| **Reusability** | 8 | Framework reusable; modul console masih berbau framework module (JSDoc) |
| **Security** | 3 | Plaintext password, seed credential, tanpa token/session — utang terbesar |
| **Testability** | 8 | 509 test hijau; test framework solid (vitest); console belum punya test sendiri |
| **Deployment** | 8 | Nginx + PM2 berjalan; config terpusat di `platform/config`; proses manual |
| **Overall** | **7.25 / 10** | Fondasi arsitektur siap; security & backend coupling adalah gap utama |

---

## 11. GO / NO GO

### ✅ **GO** — dengan syarat

Migrasi arsitektur Phase 1 dinyatakan sukses dan fondasi layak menjadi pusat kendali SMART Platform.

**Syarat (harus masuk backlog terdekat, sebelum SP-027 fitur publik):**
1. Perbaikan autentikasi: hashing password + token/session server + RBAC server-side (C1, C2, H1, H2, H3).
2. Penghapusan kredensial seed default dari produksi.
3. Perencanaan pemisahan backend Console (M1).

**Alasan GO:** Seluruh SUCCESS CRITERIA Milestone 0 terpenuhi — tidak ada dependency Console→Inventory,
tidak ada platform module di Inventory, tidak ada business module di Console, framework bersih,
routing sesuai arsitektur, build & test hijau. Temuan CRITICAL/HIGH adalah utang **pra-eksisting**
(autentikasi), bukan cacat dari hasil migrasi, sehingga tidak menghalangi GO untuk kerja arsitektur
lanjutan — tetapi HARUS dituntaskan sebelum membuka fitur ke pengguna nyata.

---

## LAMPIRAN A — DETAIL HASIL AUDIT PER BAGIAN

### A1. APPLICATION STRUCTURE ✅
- `apps/console` (16 file): main, pages (login, platform), modules/platform (dashboard, login), router, layouts, services (companies, platform, superadmins), assets. Sesuai struktur target SP-027.
- `apps/inventory` (39+ file src): business pages + data + router + config. Tanpa folder `pages/platform` (sudah dihapus).
- `packages/` (6): core, ui, api, data, config, inventory-ui — sesuai SP-026.
- `platform/`: config nginx, deploy script, bootstrap, monitoring, docs.
- `shared/`: `data/wilayah.json` (dataset wilayah).

### A2. DEPENDENCY ✅
- Console → hanya 4 framework package. 0 import ke inventory. (grep import: 0 match pelanggaran)
- Inventory → framework + `@smart/inventory-ui`. 0 import ke console.

### A3. ROUTING ✅
- master→console/dist, inv→inventory/dist. Aktif di `/etc/nginx/sites-enabled`. Live 200 OK.

### A4. AUTHENTICATION ✅ (struktur) / ⚠️ (keamanan)
- Super Admin Login: `apps/console/src/modules/platform/login.js` (POST `/api/superadmins/login`).
- Inventory login: `apps/inventory/src/pages/login/index.js` (regular user). Tidak ada superadmin login di inventory.
- Role/Permission: dari `@smart/core` (framework). ⚠️ Keamanan: plaintext, lihat C1/H1.

### A5. MENU ✅
- Console nav: Aplikasi, Kelola Perusahaan, User, Pengaturan — `apps/console/src/modules/platform/dashboard.js:81-84`. (Monitoring/Logs/Billing/AI belum diimplementasikan — sesuai roadmap, bukan pelanggaran.)
- Inventory menu: Dashboard, Master, Transaksi, Persediaan, Laporan, Settings — tanpa platform (`apps/inventory/src/config/menu.js`).

### A6. PLATFORM MODULE ✅
- Hanya di `apps/console/src/modules/platform/` (dashboard.js, login.js, index.js).
- `packages/smart-ui/src/modules/platform/` sudah dihapus (git: D).

### A7. BUSINESS MODULE ✅
- Hanya di `packages/smart-inventory-ui/src/modules/`: barang, dashboard, laporan, pembelian, penjualan, transfer.
- Console: 0 module business.

### A8. FRAMEWORK ✅
- `@smart/core|ui|api|data` tidak mengandung business logic inventory. PlatformManager (`@smart/core/src/platform`) = registry app + mapping company, concern framework, sah.
- Tidak ada superadmin/platform-dashboard di framework package.

### A9. API ⚠️ (backend bersama)
- Platform API (dipakai Console): `/api/superadmins/*`, `/api/companies`, `/api/platform/*`, `/api/wilayah/*`, `/api/auth/register/code`.
- Business API (dipakai Inventory): barang, kategori, satuan, warehouse, supplier, customer, rak, pembelian, penjualan, transfer, stock-opname, inventory-monitoring, laporan, retur*, sales, activity, auth-google.
- **Catatan:** seluruhnya dimount di satu Express (`apps/inventory/server/index.js`) → M1.

### A10. CODE QUALITY ⚠️
- Dead code: bersih (export `listAllCompanies`, `onAppLogoRemove`, `removeAppLogo` sudah dihapus saat review).
- Duplicate: tidak ditemukan (getAppEntryUrl tunggal).
- Circular dependency: tidak ditemukan.
- Unused import/export: bersih di file yang di-review.
- Deprecated API: tidak ditemukan.
- Hardcoded config: domain inventory (M2).
- Magic number/string: minor (limit 999, TTL 3600000) — dapat dikonstankan.
- Architecture violation: M1 (backend bersama).

### A11. SECURITY ⚠️ (lihat C1, C2, H1-H3)
- Auth: plaintext password; tanpa token/JWT/session.
- Env var: server membaca `MONGO_URI`, `PORT`, `RESEND_API_KEY`, `SMTP_*` dari `process.env` (baik).
- Credential: seed default hardcoded (C2).
- Tidak ada secret yang bocor di repo selain seed (password demo).

### A12. BUILD ✅
- Console build: 634ms OK. Inventory build: 849ms OK.
- Test: 21 files, **509/509 pass**.
- Lint: 40 error (semua `no-undef` browser-global, pra-eksisting) + 160 warning.
