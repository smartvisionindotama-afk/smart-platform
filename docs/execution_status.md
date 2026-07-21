# Execution Status

| Roadmap   | Task                                  | Status | Date       | Notes                                                                 |
|-----------|---------------------------------------|--------|------------|-----------------------------------------------------------------------|
| Framework | A-01 Sidebar Fix                      | ✅     | Sprint 1   | Removed module-level `sidebarClickAttached` flag.                     |
| Framework | A-02 Export Fix                       | ✅     | Sprint 1   | Full re-export of all 22 components from `@smart/ui`.                 |
| EPIC-001  | **Company Context → smart-core**      | ✅     | 2026-07-15 | `setCompanyContext`, `getCompanyCode`, `tagWithCompany` dll pindah ke framework. |
| EPIC-001  | **BrandingContext → smart-core**      | ✅     | 2026-07-15 | `BrandingManager` — logo, favicon, companyName, workspace, theme.     |
| EPIC-001  | **Company Types → smart-core**        | ✅     | 2026-07-15 | `COMPANY_TYPES` 16 jenis.                                             |
| EPIC-001  | **Persistence → smart-data**          | ✅     | 2026-07-15 | `createStore()` dari Inventory pindah.                                |
| EPIC-001  | **MongoDB Connection → smart-data**   | ✅     | 2026-07-15 | `dbConfig`, `checkConnection`, `createApiRepository`.                 |
| EPIC-001  | **BaseRepository → smart-data**       | ✅     | 2026-07-15 | `BaseRepository` + `InMemoryRepository`.                              |
| EPIC-001  | **API Fallback → smart-api**          | ✅     | 2026-07-15 | 10 API fallback utilities.                                            |
| EPIC-001  | **PageContainer → smart-ui**          | ✅     | 2026-07-15 | `PageContainer()` + `renderBreadcrumb()`.                             |
| EPIC-001  | **Settings Company → smart-ui**       | ✅     | 2026-07-15 | `SettingsCompanyModule` (DI-based).                                   |
| EPIC-001  | **Settings User → smart-ui**          | ✅     | 2026-07-15 | `SettingsUserModule` (DI-based).                                      |
| EPIC-001  | **Settings Role → smart-ui**          | ✅     | 2026-07-15 | `SettingsRoleModule` (DI-based).                                      |
| EPIC-001  | **Settings Permission → smart-ui**    | ✅     | 2026-07-15 | `SettingsPermissionModule` (DI-based).                                |
| EPIC-001  | **FrameworkContext → smart-core**     | ✅     | 2026-07-15 | `framework` singleton — unified state.                                |
| EPIC-001  | **Branding wired to Sidebar/Shell**   | ✅     | 2026-07-15 | Sidebar auto-reads dari BrandingContext.                              |
| EPIC-001  | **Server Models: status + audit**     | ✅     | 2026-07-15 | `status`, `createdBy`, `updatedBy` di semua model.                    |
| **EPIC-004** | **Impersonation Manager → smart-core** | ✅     | 2026-07-15 | `ImpersonationManager` — Login As Company Admin, session with expiry, notify on start/end/expired. |
| **EPIC-004** | **Audit Logger → smart-core**         | ✅     | 2026-07-15 | `AuditLogger` — mencatat impersonation, login, logout. Convenience methods: logImpersonationStart, logImpersonationEnd, logLogin, logLogout. |
| **EPIC-004** | **Platform Manager → smart-core**     | ✅     | 2026-07-15 | `PlatformManager` — registry aplikasi (8 built-in apps), company-app mapping, enable/disable apps per company. |
| **EPIC-004** | **Super Admin user + role**           | ✅     | 2026-07-15 | User `superadmin`/`superadmin123` dengan role `superadmin` (level 200, wildcard permissions). |
| **EPIC-004** | **Topbar Impersonation Badge → smart-ui** | ✅ | 2026-07-15 | Badge merah `LOGIN AS [Company] (Admin Perusahaan) Support Mode Active` + tombol `Kembali ke Super Admin`. |
| **EPIC-004** | **AppShell impersonation support**    | ✅     | 2026-07-15 | `AppShell` menerima `impersonation` + `onExitImpersonation` params, diteruskan ke Topbar. |
| **EPIC-004** | **Framework exports updated**         | ✅     | 2026-07-15 | `smart-core/index.js` dan `package.json` mengekspor impersonation, audit, platform. |
| **EPIC-004** | **Platform Dashboard (Super Admin)**     | ✅     | 2026-07-15 | Halaman dashboard Super Admin dengan apps grid + company management. Login superadmin → dashboard. |
| **EPIC-004** | **Company Management Page**              | ✅     | 2026-07-15 | Tabel perusahaan + 5 action buttons: ✏️ Edit, 🔑 Login As, 👁️ Profile, 📋 Subs, ⛔ Disable. Form modal, detail modal, subscription toggle, confirm disable. |
| **EPIC-004** | **Impersonation Flow**                   | ✅     | 2026-07-15 | Pilih app → pilih company → Login As Admin → sessionStorage → reload → AppShell + impersonation badge. Kembali ke Super Admin. |
| Inventory | Sprint 1 — Authentication             | ✅     | 2026-07-14 | Login page, logout, session, protected routes. Users: admin/admin123, operator/operator123. |
| Inventory | Sprint 1 — Application Shell          | ✅     | 2026-07-14 | AppShell, Sidebar, Topbar, Breadcrumb.                                |
| Inventory | Sprint 1 — Dashboard                  | ✅     | 2026-07-14 | Enhanced dashboard with stat cards, welcome banner.                   |
| Inventory | Sprint 1 — Database Layer             | ✅     | 2026-07-14 | MongoDB abstraction, framework repositories.                          |
| Inventory | Barang CRUD                           | ✅     | 2026-07-14 | Full CRUD with SMART UI components. 12 seed items.                    |
| Inventory | Settings Company CRUD                 | ✅     | 2026-07-14 | Full CRUD via framework `SettingsCompanyModule`.                      |
| Inventory | Settings User CRUD                    | ✅     | 2026-07-14 | Full CRUD with role + company assignment.                             |
| Inventory | Settings Role CRUD                    | ✅     | 2026-07-14 | Full CRUD with level hierarchy.                                       |
| Inventory | Settings Permission                   | ✅     | 2026-07-14 | Role-permission matrix with expandable groups.                        |
| Inventory | Multi-Tenant Data Isolation           | ✅     | 2026-07-14 | All entities scoped by companyCode.                                   |
| Inventory | Supplier CRUD                         | ✅     | 2026-07-15 | Full CRUD with SMART UI components. 8 seed items.                     |
| **Framework** | **Company SDK Refactoring**        | ✅     | 2026-07-16 | Company menjadi SDK: company-manager, company-session, company-storage, company-validator. SMART.Session global singleton. BaseRepository auto-company scoping. SMART namespace (SMART.Session, SMART.Company, SMART.Permission, etc). |
| **Framework** | **Company Types Simplified**        | ✅     | 2026-07-16 | COMPANY_TYPES disederhanakan: PT, CV, Perorangan, BUMDes, Koperasi, Pesantren, Pemerintah, Lainnya. |
| **Framework** | **Branding Decoupled**              | ✅     | 2026-07-16 | BrandingManager tidak lagi bergantung pada company-context. Menerima data via loadFromCompany(). |
| **Framework** | **Inventory Data Layer Cleanup**    | ✅     | 2026-07-16 | Hapus dependency langsung ke filterByCompany/tagWithCompany dari data services. Gunakan BaseRepository auto-scoping. |
| **Framework** | **Architecture Refinement (13 Phases)** | ✅ | 2026-07-16 | SMART Framework jadi Enterprise SDK: SMART.Session (nested), SMART.Company (15 methods), SMART.DB, SMART.API, SMART.UI, SMART.Permission (namespace), SMART.Platform (enhanced), SMART.Audit, SMART.Impersonation. |
| **EPIC-005** | **Architecture Design Document**      | ✅ | 2026-07-16 | `docs/epic-005-architecture-design.md` — Event Bus, DI, Plugin, Lifecycle, Config, CLI, Generators. 5 conflicts identified, solutions designed. |
| **EPIC-005** | **Event Bus**                          | ⬜ | Sprint 5   | Wrapping existing onChange, backward compat. No breaking changes. |
| **EPIC-005** | **Configuration Provider**             | ⬜ | Sprint 5   | Priority chain: ENV → localStorage → workspace.json → defaults. |
| **EPIC-005** | **Lifecycle Hooks**                    | ⬜ | Sprint 5   | State machine: bootstrap → init → ready → running → destroy. |
| **EPIC-005** | **DI Container**                       | ⬜ | Sprint 6   | Optional — facade tetap langsung import. Register/resolve pattern. |
| **EPIC-005** | **Plugin System**                      | ⬜ | Sprint 6   | SMART.use(plugin), SMART.extend(name, module). Plugin lifecycle. |
| **EPIC-005** | **CLI Architecture**                   | ⬜ | Sprint 7   | New package: smart-cli. Commands: init, generate, build, dev. |
| **EPIC-005** | **Module Generator**                   | ⬜ | Sprint 7   | New package: smart-generator. CRUD module from template. |
| **EPIC-005** | **Application Generator**              | ⬜ | Sprint 7   | Full app from template. Depends on Module Generator. |
| Inventory | Pembelian CRUD                        | ⬜ | —          | Placeholder only.                                                     |
| Inventory | Customer CRUD                         | ⬜     | —          | Placeholder only.                                                     |
| **Framework** | **Platform Login Module → smart-ui** | ✅     | 2026-07-19 | `SuperAdminLoginPage` + `initSuperAdminLoginPage` di `packages/smart-ui/src/modules/platform/login.js`. Self-contained, bisa dipakai aplikasi manapun. |
| **Framework** | **Platform Dashboard Module → smart-ui** | ✅ | 2026-07-19 | `PlatformDashboardModule` DI-based di `packages/smart-ui/src/modules/platform/dashboard.js`. Menerima data services via parameter. |
| **Inventory** | **Login Separation (Super Admin vs User)** | ✅ | 2026-07-19 | Superadmin login dipisah dari user login. SuperAdmin login → `/api/superadmins/login`, User login → `/api/auth/login`. Navigasi antar form via link. |
| **Inventory** | **Platform Thin Wrappers** | ✅ | 2026-07-19 | `apps/inventory/src/pages/superadmin-login/` dan `platform/` jadi thin wrapper yang meng-import framework module dan inject data services. |
| **Infra** | **Vite host:true + CORS** | ✅ | 2026-07-19 | Vite dev server bisa diakses via IP publik (host: true). CORS updated untuk IP 101.50.2.10 dan subnet 192.168.* / 10.*.
| **Inventory** | **URL Routing: Path-based Separation** | ✅ | 2026-07-19 | `getAppMode()` di main.js. `/` → Login Inventory, `/platform` → Super Admin. Navigasi antar form pake full page navigation (href). |
| **Inventory** | **Domain Mapping Display** | ✅ | 2026-07-19 | Info domain `inv.e-profit.id` (Inventory) dan `master.e-profit.id` (Super Admin) ditampilkan di login page. |
| **Framework** | **Platform Login: href back link** | ✅ | 2026-07-19 | Back link di `packages/smart-ui/src/modules/platform/login.js` sekarang pake `href="/"` instead of JS callback. |
| **Server** | **Hapus Endpoint /api/auth/unified-login** | ✅ | 2026-07-19 | Endpoint unified-login dihapus dari `apps/inventory/server/routes/auth.js`. Cleanup unused `SuperAdmin` import. Login sekarang terpisah: User → `/api/auth/login`, SuperAdmin → `/api/superadmins/login`. |
| **Inventory** | **Hostname Detection Aktif** | ✅ | 2026-07-19 | `getAppMode()` di main.js sekarang cek `host === 'master.e-profit.id'` untuk mode platform. Fallback ke path-based `/platform` untuk development. Production tinggal DNS resolve. |
| **Infra** | **SSL Permission Fix** | ✅ | 2026-07-19 | `/etc/letsencrypt/live/` permission `700` → `755`. Nginx tidak bisa traverse ke folder sertifikat karena hanya root yang bisa akses. |
| **Infra** | **Nginx Deploy: master.e-profit.id + inv.e-profit.id** | ✅ | 2026-07-19 | Copy config dari `/srv/platform/config/nginx/` ke `/etc/nginx/sites-available/` + symlink di `sites-enabled`. Kedua domain `proxy_pass` ke `127.0.0.1:5173` (Vite). |
| **Infra** | **Vite Dev Server Started via PM2** | ✅ | 2026-07-19 | `pm2 start npm --name "inventory-vite" -- run dev` di `/srv/apps/inventory`. Process name: `inventory-vite`, PID 630610. |
| **Infra** | **Domain 200 OK Verified** | ✅ | 2026-07-19 | `curl -I http://master.e-profit.id/` → `200 OK`. `curl -I http://inv.e-profit.id/` → `200 OK`. Kedua domain sudah aktif. |
| **Infra** | **SSL Certificate via Certbot** | ✅ | 2026-07-19 | `certbot --nginx -d master.e-profit.id -d inv.e-profit.id`. Certificate path: `/etc/letsencrypt/live/master.e-profit.id/`. Expiry: 2026-10-17. |
| **Infra** | **Nginx ACME Challenge Location** | ✅ | 2026-07-19 | Added `location ^~ /.well-known/acme-challenge/` + `/var/www/acme-challenge` directory. Memungkinkan Certbot HTTP-01 validation. |
| **Infra** | **HTTPS 200 OK Verified** | ✅ | 2026-07-19 | `curl -I https://master.e-profit.id/` → `200 OK`. `curl -I https://inv.e-profit.id/` → `200 OK`. HTTP → 301 redirect ke HTTPS. |
| **Infra** | **Nginx Source Config Synced** | ✅ | 2026-07-19 | Config hasil Certbot disinkronkan dari `/etc/nginx/sites-available/` ke `/srv/platform/config/nginx/` agar tidak hilang saat deploy ulang. |
| **Inventory** | **Hapus Demo Credentials dari Login** | ✅ | 2026-07-19 | Dihapus dari `apps/inventory/src/pages/login/index.js`: demo admin/operator, link Login Super Admin, domain info inv.e-profit.id/master.e-profit.id. |
| **Framework** | **Hapus Demo & Back Link dari Super Admin Login** | ✅ | 2026-07-19 | Dihapus dari `packages/smart-ui/src/modules/platform/login.js`: demo superadmin, back link ← Kembali ke Login Inventory. CSS terkait juga dibersihkan. |
| **Inventory** | **Background Login → Warna Sidebar** | ✅ | 2026-07-19 | Inventory login page: `linear-gradient(135deg, #1e293b, #334155)` → `linear-gradient(to bottom, #1e1b4b, #982deb)` (sama dengan sidebar). |
| **Framework** | **Background Super Admin Login → Warna Sidebar** | ✅ | 2026-07-19 | Super Admin login page: `linear-gradient(135deg, #0f172a, #1e293b, #0f172a)` → `linear-gradient(to bottom, #1e1b4b, #982deb)` (sama dengan sidebar). |
| **Infra** | **Production Deployment: Build + Nginx Static Serve** | ✅ | 2026-07-19 | Vite dev server (PM2) di-stop. Nginx config diubah: `proxy_pass` ke Vite → `root /srv/apps/inventory/dist` + `try_files` SPA fallback. `/api/` di-proxy ke Express (127.0.0.1:3001). HTTP 80: `return 404` → `301 redirect` ke HTTPS. CORS Express ditambah regex `*.e-profit.id`. Build sukses (582ms). |
| **Infra** | **Vite Dev Server PM2 Stopped** | ✅ | 2026-07-19 | `inventory-vite` process (PID 630610) di-stop dan di-delete dari PM2. Tidak ada lagi Vite dev server yang rawan restart dan 403 intermittent. |
| **Infra** | **Nginx Config: Static Files + SPA Routing** | ✅ | 2026-07-19 | `location /` sekarang `try_files $uri $uri/ /index.html` dari `/srv/apps/inventory/dist`. `location /api/` proxy ke Express dengan `proxy_buffering off`. |
| **Infra** | **HTTP 301 Redirect** | ✅ | 2026-07-19 | HTTP (port 80) diubah dari `return 404` (Certbot default) menjadi `return 301 https://$host$request_uri`. |
| **Framework** | **Platform Dashboard: Logo di Header** | ✅ | 2026-07-19 | `PlatformDashboardModule` sekarang menerima parameter `logo`. Header dashboard diubah dari emoji 🚀 menjadi logo image (sama dengan login page). CSS `.pd-logo-img` max 120x80. |
| **Inventory** | **Platform Dashboard Logo: Factory + Logo Passthrough** | ✅ | 2026-07-19 | `pages/platform/index.js` di-refactor: export baru `createPlatformDashboard({logo})`. Default backward compat dipertahankan. `main.js` fetch logo dari API dan pass ke dashboard via factory. |

## ═══════════════════════════════════════════════
## REFACTORING & FIXES (2026-07-20)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Framework** | **Enterprise RBAC — Test Validation** | ✅ | 2026-07-20 | Audit 17 test gagal di permission.test.js. Semua karena test masih pakai arsitektur lama (viewer/manager, hardcoded permissions). Refactor test tanpa menyentuh source code framework. 509/509 tests PASS. `docs/platform-architecture-audit.md` |
| **Framework** | **Server Route: /api/platform/logo** | ✅ | 2026-07-20 | Route baru `apps/inventory/server/routes/platform.js` — GET/POST/DELETE untuk menyimpan logo di server (file-based). Bisa diakses seluruh subdomain. |
| **Framework** | **Logo Upload: Direct POST from Dashboard** | ✅ | 2026-07-20 | Dashboard settings (``showSettingsView``) sekarang langsung POST ke `/api/platform/logo` tanpa bergantung DI callback. DI callback tetap dipanggil untuk kompatibilitas. |
| **Framework** | **DI Callback: onLogoUpload/onLogoRemove** | ✅ | 2026-07-20 | `PlatformDashboardModule` ditambah parameter `onLogoUpload`/`onLogoRemove`. Dipanggil saat logo diupload/dihapus. |
| **Inventory** | **Platform Wrapper: Logo Upload API** | ✅ | 2026-07-20 | `pages/platform/index.js` pass `uploadLogoToServer`/`removeLogoFromServer` via DI ke dashboard framework. |
| **Inventory** | **Login: fetchCompanyLogo coba /api/platform/logo** | ✅ | 2026-07-20 | `main.js` — `fetchCompanyLogo()` coba `/api/platform/logo` dulu, fallback ke `/api/companies`. Prioritas: localStorage → server API → company API. |
| **Framework** | **Logo Circular (Lingkaran)** | ✅ | 2026-07-20 | `.login-logo-img`, `.sa-logo-img`, `.pd-settings-logo-preview-img` diubah jadi lingkaran (`border-radius: 50%`, 100x100px, `object-fit: cover`). Konsisten di Inventory login, Super Admin login, dan settings preview. |
| **Inventory** | **Topbar: SMART Inventory** | ✅ | 2026-07-20 | `institution.js` `name` diubah dari `"SMART Warehouse"` → `"SMART Inventory"`. `workspace/warehouse/workspace.json` `topbarTitle` juga diubah. Konsisten dengan form login. |
| **Inventory** | **Cleanup: Hapus superadmin-login wrapper** | ✅ | 2026-07-20 | Hapus `apps/inventory/src/pages/superadmin-login/`. `main.js` langsung import `SuperAdminLoginPage`/`initSuperAdminLoginPage` dari `@smart/ui` dengan object API yang benar. |
| **Infra** | **Express Server PM2 Restart** | ✅ | 2026-07-20 | `pm2 restart inventory-server` — memuat route `/api/platform/logo` yang baru. |
| **Infra** | **Frontend Rebuild (3x)** | ✅ | 2026-07-20 | Build ulang 3 kali: CSS lingkaran, institution name, cleanup wrapper. Semua sukses. |
| **Inventory** | **Cleanup: Hapus 3 unused re-export files** | ✅ | 2026-07-20 | Hapus `data/base-repository.js`, `data/company-context.js`, `data/mongodb.js` — semua re-export dari framework, sudah tidak dipakai. Update `data/index.js`. |

## ═══════════════════════════════════════════════
## SPRINT 2 — MASTER DATA COMPLETION (2026-07-20)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Inventory** | **Kategori MongoDB Model + Route** | ✅ | 2026-07-20 | `server/models/Kategori.js` — companyCode required, compound index. `server/routes/kategori.js` — full CRUD with company scoping via x-company-code. |
| **Inventory** | **Satuan MongoDB Model + Route** | ✅ | 2026-07-20 | `server/models/Satuan.js` + `server/routes/satuan.js`. Menu renamed from 'Unit' to 'Satuan' (Indonesian). Permission renamed from `inventory.unit.*` to `inventory.satuan.*`. |
| **Inventory** | **Warehouse MongoDB Model + Route** | ✅ | 2026-07-20 | `server/models/Warehouse.js` + `server/routes/warehouse.js` — includes alamat, kontak, telepon. |
| **Inventory** | **Supplier MongoDB Model + Route** | ✅ | 2026-07-20 | `server/models/Supplier.js` + `server/routes/supplier.js` — sebelumnya hanya client-side, sekarang ada server backend juga. |
| **Inventory** | **Customer MongoDB Model + Route** | ✅ | 2026-07-20 | `server/models/Customer.js` + `server/routes/customer.js` — full CRUD with company scoping. |
| **Inventory** | **Seed Data: Kategori, Satuan, Warehouse, Customer** | ✅ | 2026-07-20 | KATEGORI_SEED (9 items), SATUAN_SEED (12 items), WAREHOUSE_SEED (3 items), CUSTOMER_SEED (4 items). Semua di-seed saat first connect. |
| **Inventory** | **Client Data Services (4)** | ✅ | 2026-07-20 | `kategori-data.js`, `satuan-data.js`, `warehouse-data.js`, `customer-data.js` — API-first dengan in-memory fallback. Multi-tenant via companyCode. |
| **Inventory** | **Client Pages (4): Kategori, Satuan, Warehouse, Customer** | ✅ | 2026-07-20 | Full CRUD pages dengan SMART UI components. Terdaftar di router + menu. |
| **Inventory** | **Barang: Dropdown Dinamis dari Master Data** | ✅ | 2026-07-20 | Kategori & Satuan dropdown di form Barang sekarang membaca dari master data via API, bukan hardcoded. |
| **Inventory** | **Server Routes Registered** | ✅ | 2026-07-20 | 5 routes baru (kategori, satuan, warehouse, supplier, customer) terdaftar di `server/index.js`. |
| **Infra** | **Frontend Rebuild (Sprint 2)** | ✅ | 2026-07-20 | Build 377ms. 509 tests PASS. |

## ═══════════════════════════════════════════════
## BARCODE SCANNER — DIAGNOSTIK (2026-07-21)
## ═══════════════════════════════════════════════

| Task | Status | Date | Notes |
|------|--------|------|-------|
| **Scanner: Hapus formatsToSupport dari config** | ✅ | 2026-07-21 | `formatsToSupport` di `start()` config tidak diproses library (hanya diterima constructor). Dihapus agar library scan semua format default. |
| **Scanner: Hapus qrbox (full frame scan)** | ✅ | 2026-07-21 | Hapus `qrbox: { width: 200, height: 120 }` — library sekarang scan seluruh frame video. |
| **Scanner: Container height 180px → 280px** | ✅ | 2026-07-21 | Naikkan container camera dari 180px ke 280px untuk canvas ZXing yang lebih besar. |
| **Scanner: deviceId { exact } → non-exact** | ✅ | 2026-07-21 | `deviceId: { exact: cam.id }` too strict untuk beberapa browser mobile. Ganti ke `deviceId: cam.id`. |
| **Scanner: Hapus video CSS !important** | ✅ | 2026-07-21 | Hapus `width: 100% !important; height: 100% !important; object-fit: cover !important;` — biarkan library kontrol sizing. |
| **Scanner: Prioritas kamera diubah** | ✅ | 2026-07-21 | Urutan: deviceId enumerasi → facingMode environment → facingMode user. Sebelumnya: facingMode dulu. |
| **Scanner: verbose:true dihapus** | ✅ | 2026-07-21 | `verbose: true` banjiri console dengan ZXing debug log tiap frame. Dihapus. |
| **Scanner: Decode error log tiap 100 frame** | ✅ | 2026-07-21 | Ganti dari `console.warn` tiap frame (10x/detik) jadi log setiap 100 frame (~10 detik). |
| **Scanner: MediaStream track state check** | ✅ | 2026-07-21 | Tambah `video.srcObject?.getVideoTracks()?.[0]?.readyState` — untuk deteksi apakah stream live/ended. |
| **⚠️ PROBLEM: VIDEO 0x0, readyState=0, no CANVAS** | ❌ | 2026-07-21 | Diagnostic: container cuma berisi 1 VIDEO element. Video: `0x0, readyState=0, paused=false`. Tidak ada CANVAS. Kamera start (getUserMedia sukses) tapi stream TIDAK mengirim frame. Bisa jadi bug library atau masalah browser security policy. **Belum teratasi.** |
| **Scanner: Refactor ke Framework component** | ✅ | 2026-07-22 | Scanner dipindah ke `packages/smart-ui/src/components/scanner/` sebagai `UI.BarcodeScanner` class. Barang page panggil via `new UI.BarcodeScanner()`. Otomatis pilih kamera (HP→belakang, Laptop→depan) + switch camera. |
| **⚠️ Scanner: Front camera tidak berfungsi** | ❌ | 2026-07-22 | Setelah refactor ke framework, scanner gagal start dengan kamera depan (laptop/HP). Toast: "⚠️ Kamera tidak tersedia". Fix import `Html5Qrcode` sudah diterapkan, tapi front camera tetap bermasalah. Kemungkinan bug internal library `html5-qrcode` dengan `facingMode: "user"` pada browser tertentu. **Belum teratasi.** |

## ═══════════════════════════════════════════════
## SPRINT 2.5 — UI HARMONISASI + REFACTOR (2026-07-22)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Inventory** | **Barang HP: Card View + Layout** | ✅ | 2026-07-22 | Card view mobile: nama ungu, kode biru/merah/ungu, shadow border, scroll tanpa zoom. Pagination di luar card. Search + button 1 baris. Desktop tetap tabel. |
| **Inventory** | **Master Data HP: Card View seragam** | ✅ | 2026-07-22 | Kategori, Satuan, Warehouse, Customer, Supplier — semua mobile card view konsisten dengan Barang (border biru, shadow, nama ungu, kode biru, tombol edit/hapus). |
| **Inventory** | **Kategori/Satuan: Deskripsi di card** | ✅ | 2026-07-22 | Deskripsi rata kanan, max 50% lebar, line-clamp 3 baris, sejajar dengan nama. |
| **Inventory** | **Page header rata kiri + alamat dihapus dari card** | ✅ | 2026-07-22 | Semua halaman: title di atas, actions di bawah (HP). Alamat dihapus dari card customer/supplier. |
| **Framework** | **UI.CardList component** | ✅ | 2026-07-22 | `packages/smart-ui/src/components/card-list/` — `CardList(items, renderContent)` + `attachCardEvents()`. CSS: border #2563eb, shadow, nama ungu, kode biru, tombol edit/hapus. Diexport via UI.CardList / UI.attachCardEvents. |
| **Framework** | **UI.BarcodeScanner component** | ✅ | 2026-07-22 | `packages/smart-ui/src/components/scanner/` — `BarcodeScanner` class. Auto camera selection (HP→back, laptop→front), switch camera. Diexport via UI.BarcodeScanner. Memiliki scanner CSS (corner frame, scan line, ripple, flash). |
| **Inventory** | **Barang: Refactor card + scanner ke framework** | ✅ | 2026-07-22 | `renderBarangCards` → `UI.CardList()`. Scanner → `new UI.BarcodeScanner()`. Hapus ~200 baris scanner CSS + ~30 baris card CSS (sekarang di framework). |
| **Inventory** | **5 CRUD pages: Refactor card ke framework** | ✅ | 2026-07-22 | Kategori, Satuan, Warehouse, Customer, Supplier — `renderCrudCards` → `UI.CardList()` + `UI.attachCardEvents()`. Duplicate card CSS dihapus dari masing-masing `getStyles()`. |
| **Framework** | **Scanner: Fix Html5Qrcode import missing** | ✅ | 2026-07-22 | `scanner.js` ditambah `import { Html5Qrcode } from "html5-qrcode"`. Sebelumnya `Html5Qrcode` undefined karena pindah dari barang page ke framework tanpa import. `html5-qrcode` ditambah ke smart-ui dependencies. |
| **Framework** | **Test: getScannerConfig → BarcodeScanner.getConfig** | ✅ | 2026-07-22 | `barang/index.test.js` diupdate: import dari `./index.js` (dihapus) → import dari `@smart/ui` dan test `new UI.BarcodeScanner().getConfig()`. |
| **Inventory** | **Sort ascending by nama (6 pages)** | ✅ | 2026-07-22 | `state.items.sort((a, b) => (a.nama || "").localeCompare(...))` ditambahkan di loadData() untuk Barang, Kategori, Satuan, Warehouse, Customer, Supplier. Case-insensitive. Berlaku untuk HP (card) dan Desktop (table). |
| **Inventory** | **Dashboard padding & gap konsisten** | ✅ | 2026-07-22 | Dashboard mobile: padding 0.75rem 0.25rem, gap stat cards 0.75rem, border-radius 10px, shadow sama dg card barang. Welcome card stacked di HP. |

## ═══════════════════════════════════════════════
## ACTIVITY LOG + SEED F&B (2026-07-22)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Server** | **ActivityLog Model** | ✅ | 2026-07-22 | `server/models/ActivityLog.js` — companyCode, action (create/update/delete), resource, resourceName, resourceCode, userName. Indexed. |
| **Server** | **Route /api/activity** | ✅ | 2026-07-22 | `server/routes/activity.js` — GET dengan pagination, company scoping, optional resource filter. |
| **Server** | **Barang: Activity Logging** | ✅ | 2026-07-22 | ActivityLog.create() di setiap create/update/delete barang. Baca x-user-name dari header. |
| **Client** | **listActivity data service** | ✅ | 2026-07-22 | `src/data/activity-data.js` — fetch dari /api/activity. Fallback empty array. |
| **Client** | **API: x-user-name header** | ✅ | 2026-07-22 | Kirim header x-user-name dari SMART.Session untuk activity logging. |
| **Dashboard** | **Aktivitas Terbaru + Stok Menipis** | ✅ | 2026-07-22 | Render 5 aktivitas terbaru (icon + teks + timeago). Stok menipis dihitung dari barang dg stok ≤ stok_minimum. CSS activity list, item, icon, badge. |
| **Seed** | **BARANG_SEED → F&B (12)** | ✅ | 2026-07-22 | Semua barang diubah ke Food & Beverage: Air Mineral, Kopi, Gula Pasir, Tepung, Minyak Goreng, Nugget, Sosis, Kecap, Saus, Keripik, Susu UHT, Roti Tawar. 3 item stok sengaja < minimum utk tes. |
| **Seed** | **KATEGORI_SEED → F&B (9)** | ✅ | 2026-07-22 | Minuman, Makanan Ringan, Bumbu & Saus, Bahan Baku, Frozen Food, Susu & Olahan, Roti & Kue, Kemasan, Lainnya. |
| **Seed** | **SATUAN_SEED → F&B (12)** | ✅ | 2026-07-22 | Gram, Ml, Pack, Botol, Gelas, Karton, Sachet ditambahkan. Sak, Batang, Lembar, Meter, Roll dihapus. |
| **Seed** | **Activity Log dari DB asli** | ✅ | 2026-07-22 | Seed activity log baca dari koleksi Barang asli (jika ada data), bukan dari BARANG_SEED array. Stale seed entries (resourceId /^seed-/) dibersihkan otomatis. |
| **Deploy** | **Build + Restart Server** | ✅ | 2026-07-22 | vite build (781ms). pm2 restart inventory-server — route & model activity log aktif. |

## ═══════════════════════════════════════════════
## DASHBOARD — STOK & LAYOUT (2026-07-22)
## ═══════════════════════════════════════════════

| Task | Status | Date | Notes |
|------|--------|------|-------|
| **Stok Menipis: stok 1-4** | ✅ | 2026-07-22 | Filter diubah dari `stok <= stok_minimum` jadi `stok > 0 && stok < 5`. Stok 0 = habis, bukan menipis. |
| **Stok Habis: stat baru** | ✅ | 2026-07-22 | Kartu stat baru untuk stok = 0 dengan icon 🚫 background merah. Total 5 stat cards di dashboard. |
| **5 Kartu 1 Baris Desktop** | ✅ | 2026-07-22 | `stats-grid` diubah dari `repeat(auto-fit, minmax(220px,1fr))` jadi `repeat(5, 1fr)` — 5 kartu dalam 1 baris. Mobile tetap 2/1 kolom. |

## ═══════════════════════════════════════════════
## COMPANY SDK REFACTORING (2026-07-16)
## ═══════════════════════════════════════════════

### Company SDK — New Architecture

Folder `packages/smart-core/src/company/` diubah menjadi Company SDK dengan struktur berikut:

| Module | File | Description |
|--------|------|-------------|
| Company Context | `company-context.js` | (Dipertahankan) Module-level context dengan backward-compatible function API (setCompanyContext, getCompanyCode, tagWithCompany, filterByCompany). |
| Branding | `branding.js` | `BrandingManager` — decoupled dari company-context. Menerima data via `loadFromCompany()` dan `setOverrides()`. Menyediakan logo, favicon, companyName, workspace, theme, dll. |
| Company Types | `company-types.js` | `COMPANY_TYPES` — Disederhanakan menjadi 8 jenis: PT, CV, Perorangan, BUMDes, Koperasi, Pesantren, Pemerintah, Lainnya. |
| **Company Storage** | `company-storage.js` | **NEW** `SmartStorage` — storage abstraction dengan localStorage fallback ke in-memory Map. Prefix "smart_company_". |
| **Company Validator** | `company-validator.js` | **NEW** Validation helpers: validateCompanyCode(), validateCompanyName(), validateEmail(), validatePhone(), validateCompanyType(), validateCompanyData(). |
| **Company Session** | `company-session.js` | **NEW** `CompanySession` — mengelola session perusahaan. Fields: userId, companyId, companyCode, companyName, companyType, applicationId, workspace, role, permissions, logo, theme. Methods: create(), get(), update(), save(), load(), restore(), destroy(), isActive(). |
| **Company Manager** | `company-manager.js` | **NEW** `CompanyManager` — orchestrator. Methods: setCompany(), getCompany(), clear(), switchCompany(), loadBranding(), loadWorkspace(). Memiliki onChange() subscribers. |

### SMART.Session — Global Session Singleton

**File:** `packages/smart-core/src/session/index.js` (NEW)

Global singleton `SMART.Session` yang dapat dipanggil dari seluruh aplikasi:

```js
SMART.Session.userId        // Current user ID
SMART.Session.companyId     // Current company database ID
SMART.Session.companyCode   // Current company code
SMART.Session.companyName   // Current company display name
SMART.Session.companyType   // Company type (PT, CV, etc.)
SMART.Session.workspace     // Active workspace
SMART.Session.role          // Current user role
SMART.Session.permissions   // Current user permissions
SMART.Session.logo          // Company logo URL
SMART.Session.theme         // Active theme
```

Methods: `init()`, `getState()`, `save()`, `restore()`, `destroy()`, `update()`

### SMART Namespace — Unified Public API

**File:** `packages/smart-core/src/index.js` (UPDATED)

```js
SMART.Session.companyCode       // Session
SMART.Company.get()              // Company Manager
SMART.Company.branding()         // Branding
SMART.Company.switch()           // Switch Company
SMART.Permission.can()           // Permission check
SMART.Platform.currentApplication()  // Platform
SMART.Audit.log()                // Audit
SMART.Impersonation.loginAs()    // Impersonation
```

`SMART` juga di-attach ke `globalThis` untuk akses dari console.

### BaseRepository — Auto Company Scoping

**File:** `packages/smart-data/src/base-repository.js` (UPDATED)

`BaseRepository` sekarang otomatis membaca companyCode dari `SMART.Session`:

```js
// Methods baru:
_getCompanyCode()  // Reads from SMART.Session
_tagWithCompany()  // Auto-tags data with companyCode
_filterByCompany() // Auto-filters items by companyCode
```

Programmer tidak perlu lagi memanggil `getCompanyCode()`, `tagWithCompany()`, atau `filterByCompany()` secara manual.

### Inventory Data Layer — Cleanup

| File | Change |
|------|--------|
| `settings-data.js` | Hapus import `filterByCompany`, `tagWithCompany` dari framework. Gunakan local helper `_filterData()` / `_tagData()` yang membaca dari SMART.Session. |
| `barang-data.js` | Hapus import `filterByCompany`, `tagWithCompany` dari framework. Gunakan local helper. |
| `supplier-data.js` | Hapus import `filterByCompany`, `tagWithCompany` dari framework. Gunakan local helper. |
| `api.js` | Mempertahankan `getCompanyCode()` untuk header `x-company-code` pada API calls. |

### FrameworkContext — Updated

**File:** `packages/smart-core/src/context/index.js` (UPDATED)

Sekarang subscribe ke:
- `Auth.onChange()` — auth state
- `companySession.onChange()` — session changes
- `companyManager.onChange()` — company manager changes
- `branding.onChange()` — branding changes
- `Permission.onChange()` — permission changes

### Backward Compatibility

Semua export lama tetap berfungsi:
- `setCompanyContext()`, `getCompanyCode()`, `getCompanyName()`, `clearCompanyContext()`, `hasCompanyContext()`, `tagWithCompany()`, `filterByCompany()`
- `branding`, `companyManager`
- `COMPANY_TYPES`, `getCompanyTypeOptions()`
- `framework`, `impersonation`, `audit`, `platform`

### Architecture Diagram (Updated)

```
@smart/core                             Inventory (thin)
──────────                             ────────────────
  ├── auth/                            apps/inventory
  ├── permission/                        ├── data/
  │   └── roles.js ← Namespace perms    │   ├── settings-data.js
  ├── company/     ← COMPANY SDK        │   ├── barang-data.js
  │   ├── company-manager.js             │   ├── supplier-data.js
  │   ├── company-session.js             │   ├── api.js
  │   ├── company-storage.js             │   ├── superadmin-data.js
  │   ├── company-validator.js           │   └── [framework re-exports]
  │   ├── branding.js                    ├── pages/ (7 pages)
  │   ├── company-context.js  ← @deprecated  ├── config/
  │   └── company-types.js               └── router/
  ├── session/       ← SMART.Session (nested)
  ├── context/       ← FrameworkContext
  ├── impersonation/
  ├── audit/
  └── platform/     ← Enhanced (workspace, subscription)

@smart/data
  ├── base-repository.js  ← Auto company + audit fields
  ├── DB SDK               ← SMART.DB namespace
  └── ...

@smart/api
  ├── fallback utilities   ← API-first with local fallback
  └── API SDK              ← SMART.API namespace

@smart/ui
  ├── components/          ← 22 UI components
  ├── layouts/             ← Sidebar, Topbar, Shell
  ├── module/settings/     ← Company, User, Role, Permission
  └── UI SDK               ← SMART.UI namespace
```

## ═══════════════════════════════════════════════
## ARCHITECTURE REFINEMENT (2026-07-16)
## ═══════════════════════════════════════════════

### Ringkasan Perubahan

Framework SMART telah ditransformasi menjadi **Enterprise SDK** dengan 9 namespace publik:

| SDK | Namespace | Package | Status |
|-----|-----------|---------|--------|
| Session | `SMART.Session` | @smart/core | ✅ Nested object structure |
| Company | `SMART.Company` | @smart/core | ✅ 15 methods |
| Database | `SMART.DB` | @smart/data | ✅ 10 methods |
| API | `SMART.API` | @smart/api | ✅ 7 methods |
| UI | `SMART.UI` | @smart/ui | ✅ 11 components |
| Permission | `SMART.Permission` | @smart/core | ✅ Namespace-based |
| Platform | `SMART.Platform` | @smart/core | ✅ Enhanced |
| Audit | `SMART.Audit` | @smart/core | ✅ Global service |
| Impersonation | `SMART.Impersonation` | @smart/core | ✅ Global service |

### ═══════════════════════════════════════════════
### FACADE ARCHITECTURE — PUBLIC SDK (2026-07-16)
### ═══════════════════════════════════════════════

Setelah Architecture Refinement, framework ditingkatkan dengan **Facade Pattern**:

**ONE PACKAGE = ONE PUBLIC FACADE**

Programmer aplikasi TIDAK BOLEH mengetahui implementasi internal framework.
Programmer cukup mengenal `SMART.*` dan setiap package hanya mengekspos SATU Facade.

#### Architecture

| Package | Facade File | Public API | Internal Implementation |
|---------|-------------|------------|------------------------|
| @smart/core | `facade.js` | `SMART` (9 namespaces) | auth, permission, company/*, session, context, impersonation, audit, platform |
| @smart/data | `db-facade.js` | `DB` | base-repository, mongodb, persistence, cache, state |
| @smart/api | `api-facade.js` | `API` | client, error, interceptors, fallback |
| @smart/ui | `ui-facade.js` | `UI` | components/*, layouts/*, modules/* |

#### Cara Penggunaan

```js
// ✅ BENAR — Facade
import { SMART } from "@smart/core";
import { DB } from "@smart/data";
import { API } from "@smart/api";
import { UI } from "@smart/ui";

SMART.Session.company()
SMART.Company.switch()
DB.collection("barang").find({ page: 1 })
API.get("/api/barang")
UI.Modal({ open: true, title: "Hello" })

// ⚠️ @deprecated — masih berfungsi, akan dihapus
import { Auth, Permission, branding } from "@smart/core";
import { BaseRepository } from "@smart/data";
import { createClient } from "@smart/api";
import { Modal, Toast } from "@smart/ui";
```

#### SMART Facade — Full API Reference

```js
SMART.Session.create(data)      // Buat session baru
SMART.Session.restore()          // Restore dari storage
SMART.Session.save()             // Simpan ke storage
SMART.Session.destroy()          // Hapus session
SMART.Session.refresh()          // Refresh dari storage
SMART.Session.user()             // { id, name, email, role, permissions }
SMART.Session.company()          // { id, code, name, type, logo, branding, workspace }
SMART.Session.application()      // { id, code, name, version }
SMART.Session.workspace()        // String
SMART.Session.theme()            // "light" | "dark"

SMART.Company.get()              // Current company info
SMART.Company.set(code, name)    // Set company context
SMART.Company.clear()            // Clear company
SMART.Company.switch(code)       // Switch company
SMART.Company.branding()         // { logo, favicon, companyName, theme, workspace }
SMART.Company.validate(data)     // { valid, errors }
SMART.Company.types()            // ["PT", "CV", ...]
SMART.Company.exists()           // Boolean
SMART.Company.logo()             // String|null
SMART.Company.theme()            // String

SMART.DB.collection(name)        // Collection proxy
SMART.DB.find(collection, p)     // Shorthand
SMART.DB.findOne(c, id)          // Shorthand
SMART.DB.insert(c, d)            // Shorthand

SMART.API.get(url, params)       // HTTP GET
SMART.API.post(url, body)        // HTTP POST
SMART.API.put(url, body)         // HTTP PUT
SMART.API.delete(url)            // HTTP DELETE
SMART.API.upload(url, fd)        // File upload
SMART.API.download(url)          // File download

SMART.Permission.can(perm)       // Check permission
SMART.Permission.cannot(perm)    // Inverse check
SMART.Permission.hasRole(role)   // Check role
SMART.Permission.assign(r, p)    // Grant permission
SMART.Permission.revoke(r, p)    // Revoke permission

SMART.Platform.currentApp()      // Current application
SMART.Platform.currentCompany()  // Current company
SMART.Platform.loginAsCompany()  // Impersonate
SMART.Platform.subscription()    // Check subscription

SMART.Audit.log(entry)           // Record audit entry
SMART.Audit.history(filters)     // Get audit history

SMART.Impersonation.loginAs(s)   // Start impersonation
SMART.Impersonation.isImpersonating()  // Check
SMART.Impersonation.end()        // End impersonation

SMART.UI.Modal(opts)             // Open modal
SMART.UI.Toast(opts)             // Show toast
SMART.UI.PageContainer(opts)     // Page layout
```

#### Package Exports (Clean)

**@smart/core (index.js):**
```js
export { SMART, default } from "./facade.js";                // ✅ PRIMARY
// @deprecated backward compat exports berikutnya
```

**@smart/data (index.js):**
```js
export { DB } from "./db-facade.js";                           // ✅ PRIMARY
// @deprecated backward compat exports berikutnya
```

**@smart/api (index.js):**
```js
export { API } from "./api-facade.js";                         // ✅ PRIMARY
// @deprecated backward compat exports berikutnya
```

**@smart/ui (index.js):**
```js
export { UI, loadUI } from "./ui-facade.js";                  // ✅ PRIMARY
// @deprecated backward compat exports berikutnya
```

#### New Files Created (4)

| File | Purpose |
|------|---------|
| `packages/smart-core/src/facade.js` | SMART namespace — 9 sub-namespaces, globalThis.SMART |
| `packages/smart-data/src/db-facade.js` | DB namespace — collection CRUD + auto companyCode scoping |
| `packages/smart-api/src/api-facade.js` | API namespace — HTTP methods + auto company headers |
| `packages/smart-ui/src/ui-facade.js` | UI namespace — 12 components + globalThis.SMART.UI |

#### Files Modified (4)

| File | Change |
|------|--------|
| `smart-core/src/index.js` | Hanya export SMART facade + @deprecated backward compat |
| `smart-data/src/index.js` | Hanya export DB facade + @deprecated backward compat |
| `smart-api/src/index.js` | Hanya export API facade + @deprecated backward compat |
| `smart-ui/src/index.js` | Hanya export UI facade + @deprecated backward compat |

#### DB Enhancement: Auto Multi-Tenant

`DB.collection().find()` sekarang otomatis menambahkan `companyCode` filter:
```js
// Sebelum
DB.collection("barang").find({ page: 1 })
// → GET /api/barang?page=1 (SEMUA company)

// Sesudah
DB.collection("barang").find({ page: 1 })
// → GET /api/barang?page=1&companyCode=XXX (HANYA company saat ini)
```

#### Test Results
- ✅ **508 tests passing** — semua test suite sukses
- ✅ Syntax check pada semua file Facade
- ✅ Code review approved

### Perubahan Detail per Phase

#### PHASE 1: Deprecated API
Fungsi berikut ditandai `@deprecated` di `company-context.js`:
- `setCompanyContext()` → ganti dengan `SMART.Company.set()`
- `getCompanyCode()` → ganti dengan `SMART.Session.get("company.code")`
- `getCompanyName()` → ganti dengan `SMART.Session.get("company.name")`
- `clearCompanyContext()` → ganti dengan `SMART.Company.clear()`
- `hasCompanyContext()` → ganti dengan `SMART.Session.get("company.code")` (bukan `isAuthenticated()`, karena company context ≠ user login)
- `tagWithCompany()` → ganti dengan `BaseRepository._tagWithCompany()`
- `filterByCompany()` → ganti dengan `BaseRepository._filterByCompany()`

#### PHASE 2: SMART.Session — Nested Object Structure
```js
SMART.Session.user.id
SMART.Session.user.name
SMART.Session.user.email
SMART.Session.user.role
SMART.Session.company.id
SMART.Session.company.code
SMART.Session.company.name
SMART.Session.company.type
SMART.Session.company.logo
SMART.Session.company.branding
SMART.Session.company.workspace
SMART.Session.application.id
SMART.Session.application.code
SMART.Session.application.name
SMART.Session.application.version
SMART.Session.theme
SMART.Session.locale
SMART.Session.authenticated
```

Methods: `create()`, `restore()`, `save()`, `refresh()`, `destroy()`, `get(path)`

#### PHASE 3: SMART.Company — Full API
```
get(), set(), clear(), switchTo(), switch(),
branding(), validate(), types(), typeOptions(),
logo(), theme(), workspace(), tag(), filter(),
getCode(), getName(), loadBranding(), loadWorkspace()
```

#### PHASE 4-5: SMART.DB — Database SDK
```
DB.collection(name).find(params)
DB.collection(name).findOne(id)
DB.collection(name).insert(data)
DB.collection(name).update(id, data)
DB.collection(name).delete(id)
DB.collection(name).aggregate(pipeline)
DB.collection(name).transaction(operations)
DB.collection(name).batch(docs)
DB.collection(name).watch(pipeline)

// Shorthands:
DB.find(collection, params)
DB.findOne(collection, id)
DB.insert(collection, data)
DB.aggregate(collection, pipeline)
DB.batch(collection, docs)
```

`InMemoryRepository.create()` otomatis menambahkan:
- `companyCode` (dari SMART.Session)
- `createdBy`, `updatedBy` (dari SMART.Session.user.id)
- `createdAt`, `updatedAt` (timestamp)

#### PHASE 6: SMART.API — API SDK
```
API.get(url, params, opts)
API.post(url, body, opts)
API.put(url, body, opts)
API.patch(url, body, opts)
API.delete(url, opts)
API.upload(url, formData, opts)
API.download(url, opts)
```

Aplikasi tidak boleh memakai fetch() secara langsung.

#### PHASE 7: SMART.UI — UI SDK
```
UI.PageContainer(opts)
UI.Modal(opts)
UI.Table(opts)
UI.Form(opts)
UI.Button(opts)
UI.Sidebar(opts)
UI.Topbar(opts)
UI.Notification(opts)  // Toast alias
UI.Loading(opts)       // Skeleton alias
UI.Dialog(opts)
UI.Toast(opts)
UI.load()              // Initialize UI
```

#### PHASE 8: Platform Enhancement
- `getWorkspace(companyId, appSlug)` — workspace per company-app
- `getCurrentApplication()` — app dari session
- `getCurrentCompany()` — company dari session
- `version` field pada Application
- `tier` field pada CompanyApp (subscription tier)

#### PHASE 9: Namespace-based Permissions
```
// Format: {application}.{resource}.{action}
inventory.dashboard.view
inventory.barang.read
inventory.barang.create
inventory.stock.adjust
settings.company.edit
settings.user.manage
settings.permission.manage
```

#### PHASE 10-12: Public SDK
Semua namespace terdaftar di `globalThis.SMART`:
```
SMART.Session
SMART.Company
SMART.DB
SMART.API
SMART.UI
SMART.Permission
SMART.Platform
SMART.Audit
SMART.Impersonation
```

### Migration Guide

**Untuk aplikasi yang sudah ada (Inventory):**

1. Ganti `getCompanyCode()` → `SMART.Session.get("company.code")`
2. Ganti `tagWithCompany(data)` → `BaseRepository._tagWithCompany(data)`
3. Ganti `filterByCompany(items)` → `BaseRepository._filterByCompany(items)`
4. Ganti `setCompanyContext()` → `SMART.Company.set()`
5. Ganti permission `barang.view` → `inventory.barang.read`
6. Ganti permission `settings-user.view` → `settings.user.manage`
7. Inisialisasi: `SMART.DB.init(DB)` dan `SMART.API.init(API)` di main.js

### Deprecated API
| Function | Replacement |
|----------|-------------|
| `setCompanyContext()` | `SMART.Company.set()` |
| `getCompanyCode()` | `SMART.Session.get("company.code")` |
| `getCompanyName()` | `SMART.Session.get("company.name")` |
| `clearCompanyContext()` | `SMART.Company.clear()` |
| `hasCompanyContext()` | `SMART.Session.get("company.code")` |
| `tagWithCompany()` | `BaseRepository._tagWithCompany()` |
| `filterByCompany()` | `BaseRepository._filterByCompany()` |
| Permission `*.view` | Permission `{app}.{resource}.read` |

### Test Results
- ✅ **508 tests passing** — semua test suite sukses
- ✅ Permission tests updated untuk namespace format
- ✅ Menu config updated untuk namespace permissions
- ✅ Permission catalog updated di settings-data

## ═══════════════════════════════════════════════
## FRAMEWORK CLEANUP (2026-07-16)
## ═══════════════════════════════════════════════

### Ringkasan

Membersihkan framework dan memastikan konsistensi arsitektur setelah Facade Architecture:
1. Company-context.js menjadi pure wrapper ke SMART.Company/SMART.Session
2. Export internal dipindahkan ke @deprecated
3. Tidak ada duplicate class/export/circular import
4. Setiap package memiliki SATU public entry point

### Perubahan

| File | Perubahan |
|------|-----------|
| `packages/smart-core/src/company/company-context.js` | Semua fungsi jadi WRAPPER — delegate ke SMART.Company/SMART.Session. Fallback minimal hanya jika SMART belum siap. Hapus duplicate CompanyManager class. |
| `packages/smart-core/src/company/index.js` | LEGACY COMPATIBILITY LAYER header. @deprecated di setiap export legacy. |
| `packages/smart-api/src/index.js` | `apiGetCompanyCode`, `apiHeaders` dipindah dari PRIMARY API ke @deprecated. |
| `docs/execution_status.md` | Ditambahkan section FRAMEWORK CLEANUP. |
| `apps/inventory/src/main.js` | Migrasi `setCompanyContext`/`clearCompanyContext`/`getCompanyCode` ke `SMART.Company.set()`/`SMART.Company.clear()`/`SMART.Session.get("company.code")`. |

### Architecture (Final)

```
Application (Reference: Inventory)
        │
        ▼
SMART Facade  ←  import { SMART } from "@smart/core"
  ├── SMART.Session      — Session SDK
  ├── SMART.Company      — Company SDK
  ├── SMART.DB           — Database SDK (init required)
  ├── SMART.API          — API SDK (init required)
  ├── SMART.UI           — UI SDK (via globalThis)
  ├── SMART.Permission   — Permission SDK
  ├── SMART.Platform     — Platform SDK
  ├── SMART.Audit        — Audit SDK
  └── SMART.Impersonation — Impersonation SDK
        │
        ▼
Internal SDK (tersembunyi)
  ├── auth/, permission/, company/*, session/
  ├── platform/, audit/, impersonation/, context/
  └── @smart/data, @smart/api, @smart/ui
        │
        ▼
Infrastructure (MongoDB, localStorage, fetch, etc.)
```

### Public Entry Points

| Package | Import | Status |
|---------|--------|--------|
| @smart/core | `import { SMART } from "@smart/core"` | ✅ Stable |
| @smart/data | `import { DB } from "@smart/data"` | ✅ Stable |
| @smart/api | `import { API } from "@smart/api"` | ✅ Stable |
| @smart/ui | `import { UI } from "@smart/ui"` | ✅ Stable |

### Legacy yang Dipertahankan (Backward Compatibility)

| File | Alasan |
|------|--------|
| `company-context.js` | Aplikasi lama (Inventory) masih menggunakan `setCompanyContext()`, `getCompanyCode()` |
| `@smart/core` deprecated exports | Aplikasi lama import `Auth`, `Permission`, `branding`, dll |
| `@smart/data` deprecated exports | Aplikasi lama import `BaseRepository`, `InMemoryRepository` |
| `@smart/api` deprecated exports | Aplikasi lama import `apiListFallback`, `apiFetch`, dll |
| `@smart/ui` deprecated exports | Aplikasi lama import `Modal`, `Toast`, `Table` langsung |

### Technical Debt (Remaining)

| Item | Priority | Notes |
|------|----------|-------|
| `SMART.DB.init()` & `SMART.API.init()` belum di-wire | Low | Untuk akses SMART.DB/API langsung |
| `UI.Form` belum ada di library | Low | Buat komponen jika dibutuhkan |
| `hasRole()` compare display name bukan role key | Low | `hasRole("superadmin")` vs "Super Admin" |
| Inventory import `@smart/ui/layouts`, `@smart/ui/modules` | Low | Bypass facade, tapi backward compat |
| Deprecated API masih diexport | Low | Untuk backward compatibility, akan dihapus setelah migrasi penuh |

## Legend
- ✅ Completed — Fitur selesai dan stabil
- 🔄 Transition — Masih ada, tapi diganti dengan API baru
- ⬜ Planned — Belum dimulai
