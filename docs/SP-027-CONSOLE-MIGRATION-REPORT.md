# SP-027 — SMART CONSOLE MIGRATION REPORT
## Phase 1 : Extract Console From Inventory — Laporan Investigasi

**Status:** ✅ IMPLEMENTED (P1.1–P1.4) — P1.5 (deploy live) menunggu ops manual
**Tanggal:** 2026-08-04
**Basis:** Hasil audit `docs/MASTER-EPROFIT-AUDIT.md` + investigasi dependency langsung.

> **LOG IMPLEMENTASI (2026-08-04)**
> - P1.1 ✅ Scaffold `apps/console` (12 file baru) — hanya depend ke framework.
> - P1.2 ✅ Platform module dipindah: `@smart/ui/modules/platform/*` → `apps/console/src/modules/platform/`; export & subpath dihapus dari `@smart/ui` (Opsi A, disetujui).
> - P1.3 ✅ Inventory di-strip: `main.js` tanpa mode platform; `pages/platform/` & `data/superadmin-data.js` dihapus; impersonasi exit → redirect `https://master.e-profit.id/`.
> - P1.4 ✅ `platform/config/nginx/master.e-profit.id.conf` root → `/srv/apps/console/dist`; root `package.json` + `build:console` & `verify`; `docs/execution_status.md` diperbarui.
> - **Pra-requisite (di luar scope, disetujui user):** build inventory sudah rusak sejak commit `65c88d9` — `printToWindow` & helper scanner (`scannerSectionHTML`, `scanButtonHTML`, `attachScanner`) belum pernah diimplementasikan di `@smart/ui`. Sudah di-restore minimal.
> - **Validasi:** build console ✓ (547ms), build inventory ✓ (754ms), `npm test` 509/509 ✓.
> - **P1.5 (ops manual, TIDAK dieksekusi):** build → copy dist → update `/etc/nginx` → reload → verifikasi curl.
> - **Catatan lint:** error `no-undef` (browser globals: `navigator`, `Event`, `google`, `FileReader`, `MutationObserver`) adalah utang pra-eksisting di seluruh repo (eslint config tidak memuat globals browser); tidak disentuh.

---

## 0b. STATUS PERSETUJUAN

✅ **DISETUJUI 2026-08-04** — Opsi A (pindah platform module ke apps/console), langsung implementasi.

---

# 0. KEPUTUSAN ARSITEKTUR (WAJIB DISETUJUI)

### D1 — Lokasi Platform Module (`@smart/ui/modules/platform`)
**Kondisi eksisting:** Platform Dashboard (`dashboard.js`) & Super Admin Login (`login.js`) tinggal di **framework** `@smart/ui`, sedangkan data services-nya di `apps/inventory`.

| Opsi | Deskripsi | Konsekuensi |
|---|---|---|
| **A (direkomendasikan)** | **Pindahkan** `packages/smart-ui/src/modules/platform/` → `apps/console/src/modules/platform/` | Memenuhi Golden Rule #9 ("Platform Module hanya boleh berada pada apps/console"). **Framework @smart/ui berubah minimal**: hapus `export * from "./modules/platform/index.js"` (`packages/smart-ui/src/index.js:43`) dan hapus entry `"./modules/platform"` di exports map (`packages/smart-ui/package.json:19`). Risiko rendah — hanya 2 konsumen: `apps/inventory/src/main.js:22` dan `apps/inventory/src/pages/platform/index.js:11` (keduanya sedang dimigrasi). Tidak ada test yang mereferensikan modul ini. |
| B | Biarkan di `@smart/ui`, console cukup import | Nol perubahan framework, tapi melanggar Golden Rule #9 dan tidak sesuai "YANG HARUS DIPINDAHKAN" (Platform Dashboard, Super Admin Login). |

**Rekomendasi: Opsi A.** Perubahan ke framework dibenarkan oleh aturan "kecuali benar-benar diperlukan" (Golden Rule #3) — karena Rule #9 secara eksplisit menuntut platform module berada di `apps/console`.

### D2 — Server / API
Console dan Inventory **tetap berbagi satu API** (`apps/inventory/server`, port 3001) pada Phase 1. Console hanya memanggil route platform: `/api/superadmins*`, `/api/companies*`, `/api/platform/*`, `/api/auth/*`, `/api/wilayah/*` — **tidak pernah** memanggil route bisnis Inventory (barang, penjualan, dll).

- Ini berarti dependency **kode** console hanya ke framework (`@smart/core`, `@smart/ui`, `@smart/api`, `@smart/data`) + service sendiri. Server bersama adalah keputusan **deployment/ops**, bukan dependency kode.
- **Phase 2 (di luar scope):** ekstraksi server platform terpisah (`apps/console/server` atau `packages/smart-api-server`).

### D3 — Domain & Deployment
- `master.e-profit.id` → build `apps/console/dist`
- `inv.e-profit.id` → build `apps/inventory/dist` (tetap)
- Perubahan di **repo**: `platform/config/nginx/master.e-profit.id.conf` (root → `/srv/apps/console/dist`).
- Perubahan di **server** (langkah ops manual, TIDAK dieksekusi oleh agent): copy config ke `/etc/nginx`, `vite build`, `pm2`, reload nginx.

### D4 — Kesinambungan Impersonasi (Login As)
Flow "Login As Company Admin" dimulai dari **Console** (master) dan berlanjut di **Inventory** (inv). `apps/inventory/src/main.js` **tetap mempertahankan** logika restore impersonasi (`sessionStorage smart_impersonation`), namun tombol "Kembali ke Super Admin" dialihkan ke Console (`https://master.e-profit.id/`), bukan lagi ke platform dashboard lokal.

### D5 — Registrasi & Reset Password
Tetap di Inventory (halaman user-facing). Tidak masuk scope pemisahan Phase 1. (Route API `POST /api/auth/register` adalah platform API, tidak berubah.)

---

# 1. DAFTAR FILE YANG HARUS DIPINDAHKAN (MOVE)

Dari **@smart/ui → apps/console** (keputusan D1):

| # | Sumber (sekarang) | Tujuan | Isi |
|---|---|---|---|
| 1 | `packages/smart-ui/src/modules/platform/index.js` | `apps/console/src/modules/platform/index.js` | re-export login + dashboard |
| 2 | `packages/smart-ui/src/modules/platform/login.js` | `apps/console/src/modules/platform/login.js` | SuperAdminLoginPage + init |
| 3 | `packages/smart-ui/src/modules/platform/dashboard.js` | `apps/console/src/modules/platform/dashboard.js` | PlatformDashboardModule (apps grid, company mgmt, superadmin mgmt, settings logo, impersonation, subscription toggle, wilayah form) |

Dari **apps/inventory → apps/console**:

| # | Sumber (sekarang) | Tujuan | Isi |
|---|---|---|---|
| 4 | `apps/inventory/src/pages/platform/index.js` | `apps/console/src/pages/platform/index.js` | `createPlatformDashboard()` wrapper + upload/remove logo server |
| 5 | `apps/inventory/src/data/superadmin-data.js` | `apps/console/src/services/superadmins.js` | login/list/create/update/delete superadmin |
| 6 | — (fungsi company di `apps/inventory/src/data/settings-data.js`) | `apps/console/src/services/companies.js` | listCompanies, getCompany, getCompanyByCode, createCompany, updateCompany, deleteCompany (API-first, fallback lokal) |
| 7 | — (fungsi logo di `pages/platform/index.js`) | `apps/console/src/services/platform.js` | upload/remove platform logo + app logo |
| 8 | — (logika di `apps/inventory/src/main.js`) | `apps/console/src/main.js` | bootstrap console: loadUI, auth check superadmin, show login/dashboard, favicon/logo dari server |

**Catatan:** `settings-data.js` di Inventory **TIDAK dipindah** — file itu juga melayani halaman Settings > Company/User/Role/Permission milik aplikasi Inventory. Console mendapat service company sendiri yang lebih ramping (tanpa user/role/permission bisnis).

---

# 2. DAFTAR FILE YANG HARUS DIBUAT (CREATE)

```
apps/console/
├── package.json                 # name "console", deps: @smart/core, @smart/ui, @smart/api, @smart/data (workspace), devDeps: vite
├── vite.config.js               # port 5174, allowedHosts: master.e-profit.id, proxy /api → http://localhost:3001
├── index.html                   # title "SMART Console", #app, script /src/main.js
├── src/
│   ├── main.js                  # entry console (lihat #1/8)
│   ├── pages/
│   │   ├── login/index.js       # thin wrapper SuperAdminLoginPage (+ init)
│   │   └── platform/index.js    # wrapper PlatformDashboardModule + inject service console
│   ├── modules/platform/        # hasil move dari @smart/ui (login.js, dashboard.js, index.js)
│   ├── router/
│   │   ├── index.js             # router ringan (login → dashboard, guard superadmin)
│   │   └── routes.js            # daftar route console
│   ├── services/
│   │   ├── companies.js         # CRUD company (API + fallback lokal)
│   │   ├── superadmins.js       # hasil move superadmin-data.js
│   │   └── platform.js          # logo platform & app logo
│   ├── layouts/
│   │   └── index.js             # ConsoleShell (opsional wrapper layout console)
│   └── assets/
│       └── favicon.svg          # ikon console
```

**Perubahan kecil (bukan file baru) di framework @smart/ui (keputusan D1):**
- `packages/smart-ui/src/index.js` — hapus baris `export * from "./modules/platform/index.js";`
- `packages/smart-ui/package.json` — hapus entry `"./modules/platform"` dari `exports`

**Perubahan di Inventory (lihat §3).**

---

# 3. DAFTAR FILE YANG HARUS DIHAPUS / DIUBAH (DELETE / MODIFY)

### DIHAPUS dari Inventory
| # | File | Alasan |
|---|---|---|
| 1 | `apps/inventory/src/pages/platform/index.js` | Platform Dashboard pindah ke console (Rule #6: Inventory tidak boleh punya Platform Dashboard) |
| 2 | `apps/inventory/src/data/superadmin-data.js` | Pindah ke `apps/console/src/services/superadmins.js` |

### DIUBAH di Inventory
| # | File | Perubahan |
|---|---|---|
| 3 | `apps/inventory/src/main.js` | Hapus: `getAppMode()` cabang platform, `showPlatformDashboard()`, `showSuperAdminLogin()`, import `SuperAdminLoginPage`/`createPlatformDashboard`, fungsi logo khusus platform, cabang `Auth.user().role === "superadmin"`. **Pertahankan**: restore impersonasi (ubah redirect keluar ke console), `showLogin/showRegister/showResetPassword`, AppShell, sidebar/theme. Simplify: mode selalu `inventory`. |
| 4 | `apps/inventory/src/pages/login/index.js` | Hapus link/navigasi ke login super admin jika ada (cek: tidak ada — navigasi via URL `getAppMode`; konfirmasi saat implementasi) |
| 5 | `apps/inventory/vite.config.js` | `allowedHosts` boleh disederhanakan ke `inv.e-profit.id` + `.e-profit.id` (master tidak lagi dilayani Inventory) |

### DIHAPUS dari @smart/ui (keputusan D1)
| # | File | Alasan |
|---|---|---|
| 6 | `packages/smart-ui/src/modules/platform/index.js` | Pindah ke console |
| 7 | `packages/smart-ui/src/modules/platform/login.js` | Pindah ke console |
| 8 | `packages/smart-ui/src/modules/platform/dashboard.js` | Pindah ke console |
| 9 | `packages/smart-ui/src/modules/platform/` (folder) | Kosong setelah move |

### DIUBAH di Infra (repo)
| # | File | Perubahan |
|---|---|---|
| 10 | `platform/config/nginx/master.e-profit.id.conf` | `root /srv/apps/inventory/dist` → `root /srv/apps/console/dist` |

### TIDAK DIUBAH
- `packages/smart-core`, `packages/smart-api`, `packages/smart-data` (Golden Rule #3) — **tidak tersentuh**.
- `packages/smart-inventory-ui` — semua business module Inventory tetap di sini (Rule #8).
- Semua `apps/inventory/server/*` — shared platform API (D2).

---

# 4. DEPENDENCY GRAPH SEBELUM MIGRASI

```
apps/inventory (SATU build utk master + inv, mode by hostname)
  ├── @smart/core          (SMART facade, Auth, Permission, Platform, Impersonation, Audit)
  ├── @smart/ui            (UI + layouts + workspaces)
  │     └── modules/platform/*   ← PLATFORM MODULE DI FRAMEWORK (D1)
  ├── @smart/inventory-ui  (business modules)
  ├── @smart/api           (fallback helpers)
  └── @smart/data
        │
        └── src/pages/platform/*     ← WRAPPER KONSOL DI INVENTORY
        └── src/data/superadmin-data.js, settings-data.js (company)  ← SERVICE KONSOL DI INVENTORY
        │
        ▼ fetch /api/*
apps/inventory/server (Express 3001) ← shared (platform routes + business routes)
        │
        ▼
MongoDB smart_inventory

master.e-profit.id ─┐
                    ├─► nginx → /srv/apps/inventory/dist (build YANG SAMA)
inv.e-profit.id   ─┘
```

**Masalah arsitektur (yang ingin dihilangkan):**
1. Console (master) dijalankan oleh build Inventory → tergantung Inventory.
2. Platform module di framework @smart/ui → melanggar Rule #9.
3. Service ketersebar: `superadmin-data.js` & company di `data/` milik Inventory.

---

# 5. DEPENDENCY GRAPH SESUDAH MIGRASI

```
apps/console (build sendiri)                    apps/inventory (build sendiri)
  ├── @smart/core  ─────────────┐                 ├── @smart/core
  ├── @smart/ui    ─────────────┤                 ├── @smart/ui
  ├── @smart/api                │                 ├── @smart/inventory-ui (business ONLY)
  └── @smart/data               │                 ├── @smart/api
        │                       │                 └── @smart/data
        ├── src/modules/platform/*  (D1: pindah)        │
        ├── src/pages/platform/*    (wrapper kiri)      │
        └── src/services/*          (companies, superadmins, platform)  │
        │                                                   │
        ▼ fetch /api/* (hanya route platform)               ▼ fetch /api/* (hanya route bisnis)
        └──────────────────────────┬────────────────────────┘
                                   ▼
        apps/inventory/server (Express 3001) — SHARED API (D2, ops)
                                   ▼
        MongoDB smart_inventory

master.e-profit.id ─► nginx → /srv/apps/console/dist
inv.e-profit.id   ─► nginx → /srv/apps/inventory/dist
```

**Hasil yang dicapai:**
- Console hanya import framework (`@smart/core/ui/api/data`) + modul/service sendiri. **Tidak ada import dari `@smart/inventory-ui` atau `apps/inventory`.**
- Inventory tidak lagi memuat platform dashboard/login.
- Business module tetap satu-satunya di `@smart/inventory-ui`.

---

# 6. RISIKO MIGRASI

| # | Risiko | Level | Mitigasi |
|---|---|---|---|
| R1 | **Regresi visual/fungsional dashboard console** setelah modul dipindah (path import rusak) | MEDIUM | Modul dipindah apa adanya (tanpa edit isi); import relatif disesuaikan; build console wajib lulus; uji manual per view (Aplikasi, Perusahaan, User, Pengaturan) |
| R2 | **Inventory rusak** setelah platform mode dihapus dari main.js | MEDIUM | Hapus bertahap: (a) console berfungsi dulu, (b) baru strip inventory; inventory build + test wajib lulus; jalankan `npm run build --workspace=inventory` |
| R3 | **@smart/ui test/gagal** karena export platform dihapus | RENDAH | Verifikasi: tidak ada test yang mereferensikan platform module (sudah dicek — 0 test); jalankan `npm test` (packages) |
| R4 | **Konsumen lain modul platform @smart/ui** (di luar repo) | RENDAH | Grep internal hanya 2 titik (inventory). Konsumen eksternal: UNKNOWN — dicatat sebagai breaking change |
| R5 | **Impersonation putus** (Login As berhenti berfungsi lintas domain) | MEDIUM | Pertahankan restore impersonasi di inventory main.js; ubah redirect keluar ke console; test flow manual (console → login as → inv → kembali ke console) |
| R6 | **Session/localStorage lintas domain** (logo `smart_superadmin_logo` tersimpan per-domain) | RENDAH | Console prefer logo dari server `/api/platform/logo`; fallback localStorage per-domain sudah ada |
| R7 | **Build/serve path** (`/platform` dev path tidak lagi dipakai) | RENDAH | Console dev di port sendiri (5174); `/platform` dihapus dari inventory |
| R8 | **Domain live** (master tetap serve inventory build sampai nginx di-update) | RENDAH | Backwards-compatible: urutan deploy = console dist siap → update nginx → master otomatis serve console (lihat §8) |

---

# 7. BREAKING CHANGE

| # | Perubahan | Dampak | Keterangan |
|---|---|---|---|
| BC1 | `@smart/ui` tidak lagi mengekspor `modules/platform` (hapus `export * from "./modules/platform/index.js"` + subpath `./modules/platform`) | Konsumen yang import `SuperAdminLoginPage` / `PlatformDashboardModule` dari `@smart/ui` **rusak** | Hanya konsumen internal: inventory (dimigrasi). Konsumen eksternal: UNKNOWN — harus menyesuaikan ke `apps/console` |
| BC2 | `apps/inventory` tidak lagi punya mode platform (`/platform`, hostname master, login superadmin) | URL `/platform` di inv.e-profit.id tidak lagi ada | Digantikan apps/console (domain master) |
| BC3 | `apps/inventory/src/data/superadmin-data.js` & `pages/platform/` dihapus | Import internal lain akan gagal jika masih ada referensi | Harus bersih saat commit terakhir (grep sebelum hapus) |
| BC4 | Tombol "Kembali ke Super Admin" (impersonation) kini redirect ke `https://master.e-profit.id/` | URL tujuan berubah | Backwards compatible: tetap berfungsi setelah nginx master → console |
| BC5 | `platform/config/nginx/master.e-profit.id.conf` root berubah | Live master berubah dari build inventory ke build console | Ops manual, dilakukan paling akhir |

---

# 8. RENCANA MIGRASI BERTAHAP

Setiap tahap wajib: **Build → Test → Audit → Commit** (sesuai prompt). Tahap tidak boleh lanjut sebelum tahap sebelumnya lulus.

| Fase | Isi | Gate (wajib lulus) |
|---|---|---|
| **P1.0** | ✅ Selesai — Laporan investigasi ini disetujui | Persetujuan user |
| **P1.1 Scaffold Console** | Buat `apps/console` lengkap (package.json, vite.config, index.html, main.js, router, services, layouts, assets). Console **masih memakai modul platform dari @smart/ui** (belum dipindah). Console harus bisa `build` mandiri & jalan di dev :5174 | `npm run build --workspace=console` sukses; halaman login + dashboard render (dev manual) |
| **P1.2 Pindah Platform Module (D1)** | Move `@smart/ui/src/modules/platform/*` → `apps/console/src/modules/platform/`; update `packages/smart-ui/src/index.js` + `package.json` exports; update import console; **update import inventory yang masih memakai modul tersebut (sementara: fallback sementara di main.js inventory TIDAK dibuat — langsung lanjut ke P1.3 untuk inventory)** | `npm test` (packages) hijau; `npm run build --workspace=console` hijau |
| **P1.3 Strip Platform dari Inventory** | Hapus dari `apps/inventory/src/main.js`: mode platform, `showPlatformDashboard`, `showSuperAdminLogin`, import platform; ubah redirect keluar impersonasi → console; hapus `pages/platform/`, `data/superadmin-data.js`; simplify `getAppMode()`; update `vite.config.js` allowedHosts | `npm run build --workspace=inventory` hijau; `npm test` hijau; grep `modules/platform|superadmin-data|createPlatformDashboard` di apps/inventory = 0 match |
| **P1.4 Infra + Docs** | Update `platform/config/nginx/master.e-profit.id.conf` (root console); update `docs/execution_status.md` + `docs/SP-025-migration-report.md` (opsional); root `package.json` tambah script `build:console` | Review diff; `npm run verify` (lint + test + build inventory) + build console |
| **P1.5 Ops Manual (TIDAK dieksekusi agent)** | Panduan: `npm run build --workspace=console`; copy `apps/console/dist` → `/srv/apps/console/dist`; copy nginx config → `/etc/nginx/sites-available/` + symlink; `nginx -t && systemctl reload nginx`; verifikasi `curl -I https://master.e-profit.id/` → 200 (console), `curl -I https://inv.e-profit.id/` → 200 (inventory) | Verifikasi manual di server |

**Backwards compatibility selama migrasi:**
- P1.1–P1.2: master masih serve build inventory (tidak berubah) → aman.
- P1.3: inventory kehilangan mode platform di kode, tapi master masih serve build lama sampai P1.5 → tidak ada downtime.
- P1.5: update nginx adalah switch terakhir.

---

# 9. CHECKLIST IMPLEMENTASI

**Scaffold console**
- [ ] `apps/console/package.json` (workspace name `console`)
- [ ] `apps/console/vite.config.js` (port 5174, proxy /api → 3001, allowedHosts master.e-profit.id)
- [ ] `apps/console/index.html`
- [ ] `apps/console/src/main.js` (auth superadmin → login/dashboard; logo dari server)
- [ ] `apps/console/src/router/` (index.js + routes.js)
- [ ] `apps/console/src/services/` (companies.js, superadmins.js, platform.js)
- [ ] `apps/console/src/layouts/index.js` (ConsoleShell)
- [ ] `apps/console/src/assets/favicon.svg`

**Move platform module (D1)**
- [ ] Move 3 file `modules/platform/*` ke `apps/console/src/modules/platform/`
- [ ] `packages/smart-ui/src/index.js`: hapus export platform
- [ ] `packages/smart-ui/package.json`: hapus subpath `./modules/platform`
- [ ] Import di console: `./modules/platform` (relatif) atau path baru

**Strip inventory**
- [ ] `main.js` tanpa platform mode (verify grep: `getAppMode` → selalu inventory)
- [ ] Redirect impersonasi exit → `https://master.e-profit.id/`
- [ ] Hapus `apps/inventory/src/pages/platform/`
- [ ] Hapus `apps/inventory/src/data/superadmin-data.js`
- [ ] `vite.config.js` allowedHosts dirapikan
- [ ] Grep bebas: `modules/platform`, `superadmin-data`, `createPlatformDashboard`, `SuperAdminLoginPage` di `apps/inventory`

**Infra & docs**
- [ ] `platform/config/nginx/master.e-profit.id.conf` root → `/srv/apps/console/dist`
- [ ] Root `package.json`: tambah `build:console`
- [ ] Update `docs/execution_status.md` (entry baru) + dokumen ini → status IMPLEMENTED

**Validasi akhir**
- [ ] `npm run build --workspace=console` ✓
- [ ] `npm run build --workspace=inventory` ✓
- [ ] `npm test` ✓ (packages)
- [ ] `npm run lint` ✓
- [ ] Audit diff (code-reviewer) ✓

---

# 10. ESTIMASI EFFORT

| Aktivitas | Effort |
|---|---|
| Scaffold apps/console (files ~10) | S (1–2 jam) |
| Pindah platform module + update @smart/ui exports | S (1 jam) |
| Strip platform dari inventory (main.js + hapus 2 file) | S–M (2–3 jam) |
| Infra config + docs + validasi (build/test/lint/audit) | S (1–2 jam) |
| **Total** | **~1 hari kerja** (S–M) |

Risiko rendah karena: (1) modul dipindah apa adanya tanpa rewrite, (2) tidak ada test yang menyentuh platform module, (3) seluruh perubahan bersifat additive-then-removal dengan build gate per fase.

---

# KRITERIA SUKSES (dari prompt)

| Kriteria | Status target |
|---|---|
| ✓ master.e-profit.id dijalankan oleh apps/console | Setelah P1.5 (nginx) |
| ✓ inv.e-profit.id dijalankan oleh apps/inventory | Tetap (build sama) |
| ✓ Inventory tidak lagi memiliki Platform Dashboard | Setelah P1.3 |
| ✓ Console tidak lagi bergantung kepada Inventory | Setelah P1.2 (modul + service pindah) |
| ✓ Console hanya bergantung kepada framework | Import hanya @smart/core/ui/api/data |
| ✓ Inventory hanya bergantung framework + @smart/inventory-ui | Import @smart/ui (tanpa platform) + inventory-ui |
| ✓ Seluruh test dan build berhasil | `npm test` + build console + build inventory + lint |

---

# PERSETUJUAN

Laporan ini menunggu persetujuan sebelum implementasi dimulai (sesuai prompt: "JANGAN langsung coding").

- [ ] **Disetujui** — lanjut P1.1 (Opsi A: pindah platform module ke apps/console)
- [ ] **Disetujui dengan revisi** (catatan: …)
- [ ] **Tolak / ubah arahan** (catatan: …)
