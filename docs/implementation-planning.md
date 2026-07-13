# SMART PLATFORM — EPIC-001
## ENGINEERING EXECUTION PLAN
### Implementation Planning Document

**Role:** Chief Framework Engineer
**Strategy:** Incremental Refactoring (Strangler Fig Pattern)
**Prinsip:** Inventory harus SELALU bisa dijalankan di setiap langkah

---

## 🎯 EXECUTION STRATEGY

### Strangler Fig Pattern

Kita tidak akan melakukan **big bang refactoring**. Setiap langkah mengikuti pola:

```
Langkah 1: BUAT      → Buat file baru di lokasi target (apps & packages coexist)
Langkah 2: ALIHKAN   → Update imports di Inventory untuk pakai file baru
Langkah 3: VERIFIKASI→ Run build & manual test: Inventory masih jalan
Langkah 4: HAPUS     → Hapus file lama (setelah yakin aman)
```

### Branching Strategy

```
main
 └── epic-001/
      ├── sprint-1-monorepo-setup       → WO-001
      ├── sprint-2-core-extraction      → WO-002 + WO-007
      ├── sprint-3-ui-extraction        → WO-003 + WO-006
      ├── sprint-4-layout-engine        → WO-004 + WO-005
      └── sprint-5-workspace-template   → WO-008 + WO-009
```

Setiap sprint branch di-merge ke `epic-001` setelah diverifikasi.
Tidak ada merge ke `main` sampai seluruh EPIC-001 selesai.

---

## 📋 MASTER TASK LIST

### WO-001: Platform Monorepo Setup

| Task ID | Tujuan | Tipe | Files |
|---|---|---|---|
| **T-001** | Buat root `package.json` dengan npm/pnpm workspaces | 🆕 New file | `/srv/package.json` |
| **T-002** | Buat `packages/smart-core/package.json` | 🆕 New file | `packages/smart-core/package.json` |
| **T-003** | Buat `packages/smart-ui/package.json` | 🆕 New file | `packages/smart-ui/package.json` |
| **T-004** | Buat `packages/smart-config/` dengan shared ESLint + Vite config | 🆕 New file | `packages/smart-config/eslint/`, `packages/smart-config/vite/` |
| **T-005** | Install dependencies root & verifikasi workspace resolve | 🛠️ Setup | Root `package.json` |

### WO-002: Ekstraksi @smart/core

| Task ID | Tujuan | Tipe | Files |
|---|---|---|---|
| **T-006** | Copy `auth.js` → `packages/smart-core/src/auth/auth.js` | 🆕 New file | `packages/smart-core/src/auth/auth.js` |
| **T-007** | Copy `institution.js` → `packages/smart-core/src/institution/institution.js` | 🆕 New file | `packages/smart-core/src/institution/institution.js` |
| **T-008** | Copy `permission.js` → `packages/smart-core/src/permission/permission.js` | 🆕 New file | `packages/smart-core/src/permission/permission.js` |
| **T-009** | Copy `app.js` → `packages/smart-core/src/app/app.js` | 🆕 New file | `packages/smart-core/src/app/app.js` |
| **T-010** | Buat `packages/smart-core/src/index.js` sebagai barrel export | 🆕 New file | `packages/smart-core/src/index.js` |
| **T-011** | **HAPUS** workspace loader dari Core — pindahkan logika ke Smart UI nanti | 🔴 Breaking | `packages/smart-core/src/workspace/` (tidak dibuat) |
| **T-012** | Alihkan imports Inventory dari `src/core/` → `@smart/core` | 🔄 Refactor | `apps/inventory/src/core/app/bootstrap.js`, `apps/inventory/src/router/index.js`, `apps/inventory/src/components/sidebar/Sidebar.js` |
| **T-013** | Verifikasi build Inventory masih jalan | ✅ Verify | – |

### WO-003: Ekstraksi @smart/ui

| Task ID | Tujuan | Tipe | Files |
|---|---|---|---|
| **T-014** | Copy `tokens/` → `packages/smart-ui/src/tokens/` | 🆕 New file | 7 CSS files |
| **T-015** | Copy `components/` (button, card, stat-card) → `packages/smart-ui/src/components/` | 🆕 New file | 6 files + `index.js` |
| **T-016** | Buat `packages/smart-ui/src/index.js` sebagai barrel export | 🆕 New file | `packages/smart-ui/src/index.js` |
| **T-017** | Copy workspace loader logic (dari Core yang dihapus) ke `packages/smart-ui/src/workspaces/engine.js` | 🆕 New file | `packages/smart-ui/src/workspaces/engine.js` |
| **T-018** | Copy workspace variables → `packages/smart-ui/src/workspaces/` | 🆕 New file | 3 `variables.css` files |
| **T-019** | Alihkan imports Inventory dari `src/ui/` → `@smart/ui` | 🔄 Refactor | `apps/inventory/src/ui/index.js`, `apps/inventory/src/main.js`, `apps/inventory/src/core/app/bootstrap.js` |
| **T-020** | Verifikasi build Inventory masih jalan | ✅ Verify | – |

### WO-004: Layout Engine Creation

| Task ID | Tujuan | Tipe | Files |
|---|---|---|---|
| **T-021** | Buat `packages/smart-ui/src/layouts/engine.js` — Layout orchestrator | 🆕 New file | `packages/smart-ui/src/layouts/engine.js` |
| **T-022** | Buat `packages/smart-ui/src/layouts/topbar/Topbar.js` (dari `apps/inventory/src/components/topbar/Topbar.js`) | 🔄 Move file | Move: `components/topbar/Topbar.js` → `packages/smart-ui/src/layouts/topbar/Topbar.js` |
| **T-023** | Buat `packages/smart-ui/src/layouts/sidebar/Sidebar.js` (dari `apps/inventory/src/components/sidebar/Sidebar.js`) | 🔄 Move file | Move: `components/sidebar/Sidebar.js` → `packages/smart-ui/src/layouts/sidebar/Sidebar.js` |
| **T-024** | Buat `packages/smart-ui/src/layouts/shell/Shell.js` — App shell yang compose topbar + sidebar + content | 🆕 New file | `packages/smart-ui/src/layouts/shell/Shell.js` |
| **T-025** | Update `apps/inventory/src/layouts/MainLayout.js` untuk pakai Layout Engine | 🔄 Refactor | `apps/inventory/src/layouts/MainLayout.js` |
| **T-026** | **HAPUS** `apps/inventory/src/layouts/default/Layout.js` (file kosong) | 🗑️ Delete file | `apps/inventory/src/layouts/default/Layout.js` |
| **T-027** | Verifikasi build & tampilan Inventory masih sama | ✅ Verify | – |

### WO-005: Integrasi Inventory ke Platform

| Task ID | Tujuan | Tipe | Files |
|---|---|---|---|
| **T-028** | **HAPUS** `apps/inventory/src/core/` (sudah di-extract ke @smart/core) | 🗑️ Delete dir | `apps/inventory/src/core/` |
| **T-029** | **HAPUS** `apps/inventory/src/ui/` (sudah di-extract ke @smart/ui) | 🗑️ Delete dir | `apps/inventory/src/ui/` |
| **T-030** | **HAPUS** `apps/inventory/src/components/` (Topbar/Sidebar sudah pindah ke Layout Engine) | 🗑️ Delete dir | `apps/inventory/src/components/` |
| **T-031** | Update `apps/inventory/src/main.js` — hanya import dari @smart packages + app-specific modules | 🔄 Refactor | `apps/inventory/src/main.js` |
| **T-032** | Update `apps/inventory/package.json` — tambah dependency ke `@smart/core` dan `@smart/ui` | 🔄 Refactor | `apps/inventory/package.json` |
| **T-033** | Full build verification & manual test semua halaman | ✅ Verify | – |

### WO-006: Harmonisasi Design Token & Workspace

| Task ID | Tujuan | Tipe | Files |
|---|---|---|---|
| **T-034** | Standarisasi CSS variable naming di `packages/smart-ui/src/tokens/colors.css` — tambah `--surface`, `--surface-hover`, `--card-bg` deprecated | 🔄 Refactor | `packages/smart-ui/src/tokens/colors.css` |
| **T-035** | Update `packages/smart-ui/src/components/card/card.css` — ganti `--card-bg` → `--surface`, `--radius` → `--radius-lg` | 🔄 Refactor | `packages/smart-ui/src/components/card/card.css` |
| **T-036** | Update `packages/smart-ui/src/components/stat-card/stat-card.css` — ganti `--card-bg` → `--surface`, `--radius` → `--radius-lg` | 🔄 Refactor | `packages/smart-ui/src/components/stat-card/stat-card.css` |
| **T-037** | Refactor `packages/smart-ui/src/workspaces/warehouse/variables.css` — pakai design token references | 🔄 Refactor | `packages/smart-ui/src/workspaces/warehouse/variables.css` |
| **T-038** | Refactor `packages/smart-ui/src/workspaces/corporate/variables.css` — pakai design token references | 🔄 Refactor | `packages/smart-ui/src/workspaces/corporate/variables.css` |
| **T-039** | Refactor `packages/smart-ui/src/workspaces/default/variables.css` — hapus redefinisi `--primary` yang sudah ada di tokens | 🔄 Refactor | `packages/smart-ui/src/workspaces/default/variables.css` |
| **T-040** | Update `apps/inventory/src/css/main.css` — ganti hardcoded values → design tokens | 🔄 Refactor | `apps/inventory/src/css/main.css` |
| **T-041** | Verifikasi visual: semua workspace tampil sesuai dengan theme-nya | ✅ Verify | – |

### WO-007: ADR Documentation (Batch 1)

| Task ID | Tujuan | Tipe | Files |
|---|---|---|---|
| **T-042** | Buat `docs/adr/ADR-001-smart-sebagai-platform.md` | 🆕 New file | `docs/adr/ADR-001-smart-sebagai-platform.md` |
| **T-043** | Buat `docs/adr/ADR-002-workspace-over-theme.md` | 🆕 New file | `docs/adr/ADR-002-workspace-over-theme.md` |
| **T-044** | Buat `docs/adr/ADR-003-vanilla-javascript.md` | 🆕 New file | `docs/adr/ADR-003-vanilla-javascript.md` |
| **T-045** | Buat `docs/adr/ADR-004-css-custom-properties.md` | 🆕 New file | `docs/adr/ADR-004-css-custom-properties.md` |
| **T-046** | Buat `docs/adr/ADR-005-pure-function-components.md` | 🆕 New file | `docs/adr/ADR-005-pure-function-components.md` |
| **T-047** | Buat `docs/adr/ADR-006-layer-independence.md` | 🆕 New file | `docs/adr/ADR-006-layer-independence.md` |
| **T-048** | Buat `docs/adr/ADR-007-monorepo-strategy.md` | 🆕 New file | `docs/adr/ADR-007-monorepo-strategy.md` |
| **T-049** | Buat `docs/adr/index.md` — daftar semua ADR | 🆕 New file | `docs/adr/index.md` |

### WO-008: App Template Creation

| Task ID | Tujuan | Tipe | Files |
|---|---|---|---|
| **T-050** | Buat `apps/_template/package.json` — dengan dependency @smart/core, @smart/ui | 🆕 New file | `apps/_template/package.json` |
| **T-051** | Buat `apps/_template/index.html` | 🆕 New file | `apps/_template/index.html` |
| **T-052** | Buat `apps/_template/vite.config.js` | 🆕 New file | `apps/_template/vite.config.js` |
| **T-053** | Buat `apps/_template/src/main.js` | 🆕 New file | `apps/_template/src/main.js` |
| **T-054** | Buat `apps/_template/src/app.js` — app orchestrator minimal | 🆕 New file | `apps/_template/src/app.js` |
| **T-055** | Buat `apps/_template/workspace/workspace.json` — contoh konfigurasi workspace | 🆕 New file | `apps/_template/workspace/workspace.json` |
| **T-056** | Buat `apps/_template/README.md` — cara setup app baru | 🆕 New file | `apps/_template/README.md` |
| **T-057** | Verifikasi template bisa dijalankan (`cd apps/_template && npm install && npm run dev`) | ✅ Verify | – |

### WO-009: Workspace Experience Enhancement

| Task ID | Tujuan | Tipe | Files |
|---|---|---|---|
| **T-058** | Buat `packages/smart-ui/src/workspaces/engine.js` — Workspace loader yang handle CSS + layout + menu | 🆕 New file | `packages/smart-ui/src/workspaces/engine.js` |
| **T-059** | Buat schema `workspace.json` — definisi properti workspace | 🆕 New file | `packages/smart-ui/src/workspaces/schema.js` |
| **T-060** | Tambah `workspace.json` ke workspace default | 🆕 New file | `packages/smart-ui/src/workspaces/default/workspace.json` |
| **T-061** | Tambah `workspace.json` ke workspace warehouse | 🆕 New file | `packages/smart-ui/src/workspaces/warehouse/workspace.json` |
| **T-062** | Tambah `workspace.json` ke workspace corporate | 🆕 New file | `packages/smart-ui/src/workspaces/corporate/workspace.json` |
| **T-063** | Update Layout Engine untuk membaca `workspace.json` dan mengatur layout sesuai | 🔄 Refactor | `packages/smart-ui/src/layouts/engine.js` |
| **T-064** | Pindahkan `apps/inventory/src/config/menu.js` ke workspace | 🔄 Move file | Move: `apps/inventory/src/config/menu.js` → (integrated ke workspace) |

---

## 📊 DEPENDENCY GRAPH

```
                    WO-001 (Monorepo Setup)
                    ├── T-001: Root package.json
                    ├── T-002: smart-core/package.json
                    ├── T-003: smart-ui/package.json
                    └── T-004: smart-config/
                         │
            ┌────────────┼────────────────┐
            │            │                │
            ▼            ▼                ▼
      WO-002 (Core)   WO-007 (ADR)   WO-003 (UI)
      ├── T-006:CORE  ├── T-042:T-049 ├── T-014:tokens
      ├── T-007:CORE  └── docs/*      ├── T-015:comps
      ├── T-008:CORE                  ├── T-016:barrel
      ├── T-009:CORE                  ├── T-017:ws-engine
      ├── T-010:barrel                └── T-018:ws-vars
      └── T-012:redirect                   │
           │                               │
           └──────────┬────────────────────┘
                      │
                      ▼
               WO-004 (Layout)
               ├── T-021:engine.js
               ├── T-022:topbar     (MOVE)
               ├── T-023:sidebar    (MOVE)
               ├── T-024:shell.js
               └── T-025:update MainLayout
                    │
                    ▼
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
    WO-005 (Integrate)   WO-006 (Harmonize)
    ├── T-028:del core   ├── T-034:tokens
    ├── T-029:del ui     ├── T-035:card
    ├── T-030:del comps  ├── T-036:stat-card
    ├── T-031:main.js    ├── T-037:warehouse
    ├── T-032:package    ├── T-038:corporate
    └── T-033:verify     ├── T-039:default
                         ├── T-040:main.css
                         └── T-041:verify
                              │
          ┌───────────────────┘
          │
          ▼
     ┌────┴────┐
     │         │
     ▼         ▼
WO-008      WO-009
(Template)  (Workspace)
├── T-050   ├── T-058:engine
├── T-051   ├── T-059:schema
├── T-052   ├── T-060:default ws
├── T-053   ├── T-061:warehouse ws
├── T-054   ├── T-062:corporate ws
├── T-055   ├── T-063:update layout
├── T-056   └── T-064:move menu
└── T-057

Independent:
WO-007 (ADR) → bisa dikerjakan kapan saja, tidak blocking apapun
```

### Critical Path (Longest Chain)

```
T-001 → T-002 → T-006 → T-012 → T-025 → T-028 → T-033
```

Artinya: **Monorepo → Core → Redirect → Layout → Delete → Verify**
Ini adalah chain yang HARUS selesai untuk EPIC-001 bisa dianggap "done".

---

## 🏷️ TASK TAGS

| Tag | Arti | Jumlah Task |
|---|---|---|
| 🆕 **New file** | Membuat file baru, tidak mengubah yang sudah ada | 35 task |
| 🔄 **Refactor** | Mengubah isi file yang sudah ada | 12 task |
| 🔄 **Move file** | Memindahkan file dari satu lokasi ke lokasi lain | 3 task |
| 🗑️ **Delete file/dir** | Menghapus file/direktori yang sudah tidak dipakai | 4 task |
| 🔴 **Breaking** | Perubahan yang bisa break aplikasi jika tidak hati-hati | 3 task |
| ✅ **Verify** | Build verification & manual test | 5 task |
| 🛠️ **Setup** | Instalasi dependency, konfigurasi tool | 1 task |

---

## 🛡️ STRANGLER FIG PATTERN — SAFETY MECHANISM

Setiap task yang memindahkan/menghapus file **WAJIB** dilakukan dalam 4 langkah:

```
Langkah 1: 🆕 CREATE — Buat file di lokasi baru
Langkah 2: 🔄 REDIRECT — Update imports di semua consumer
Langkah 3: ✅ VERIFY — Build & test. Jika gagal → rollback
Langkah 4: 🗑️ DELETE — Hapus file lama (hanya jika langkah 3 sukses)
```

### Rollback Plan per Task

| Task | Rollback |
|---|---|
| **T-012** (redirect core imports) | `git checkout apps/inventory/src/core/app/bootstrap.js apps/inventory/src/router/index.js apps/inventory/src/components/sidebar/Sidebar.js` |
| **T-019** (redirect ui imports) | `git checkout apps/inventory/src/ui/index.js apps/inventory/src/main.js apps/inventory/src/core/app/bootstrap.js` |
| **T-022** (move topbar) | Copy file kembali dari packages ke apps + revert imports |
| **T-023** (move sidebar) | Copy file kembali dari packages ke apps + revert imports |
| **T-025** (update MainLayout) | `git checkout apps/inventory/src/layouts/MainLayout.js` |
| **T-028** (hapus core) | `git checkout apps/inventory/src/core/` — restore dari git |
| **T-029** (hapus ui) | `git checkout apps/inventory/src/ui/` — restore dari git |
| **T-030** (hapus components) | `git checkout apps/inventory/src/components/` — restore dari git |

### Global Rollback (Jika Semua Gagal)

```bash
git checkout epic-001  # Kembali ke branch awal epic
# atau
git reset --hard HEAD~5  # Kembali 5 commit sebelum masalah
```

---

## 📅 SPRINT PLAN

### SPRINT 1: Monorepo Foundation
**Durasi:** 2 hari
**Branch:** `epic-001/sprint-1-monorepo-setup`
**Tujuan:** Setup struktur monorepo dan dokumentasi ADR

| Task | Hari | Tipe | Dependensi | Status |
|---|---|---|---|---|
| T-001: Root package.json | 1 | 🆕 New | – | ⬜ |
| T-002: smart-core/package.json | 1 | 🆕 New | T-001 | ⬜ |
| T-003: smart-ui/package.json | 1 | 🆕 New | T-001 | ⬜ |
| T-004: smart-config/ | 1 | 🆕 New | T-001 | ⬜ |
| T-005: Install dependencies | 1 | 🛠️ Setup | T-001, T-002, T-003 | ⬜ |
| T-042: ADR-001 Platform | 2 | 🆕 New | – | ⬜ |
| T-043: ADR-002 Workspace | 2 | 🆕 New | – | ⬜ |
| T-044: ADR-003 Vanilla JS | 2 | 🆕 New | – | ⬜ |
| T-045: ADR-004 CSS Props | 2 | 🆕 New | – | ⬜ |
| T-046: ADR-005 Functions | 2 | 🆕 New | – | ⬜ |
| T-047: ADR-006 Independence | 2 | 🆕 New | – | ⬜ |
| T-048: ADR-007 Monorepo | 2 | 🆕 New | – | ⬜ |
| T-049: ADR index | 2 | 🆕 New | T-042..T-048 | ⬜ |

**Definition of Sprint Done:**
- ✅ `npm install` jalan di root tanpa error
- ✅ `packages/` terdaftar di workspaces
- ✅ 7 ADR file siap di `docs/adr/`
- ✅ Inventory masih jalan (belum ada perubahan)

---

### SPRINT 2: SMART Core Extraction
**Durasi:** 2 hari
**Branch:** `epic-001/sprint-2-core-extraction`
**Tujuan:** Ekstrak Core ke package, redirect imports

| Task | Hari | Tipe | Dependensi | Status |
|---|---|---|---|---|
| T-006: Copy auth.js | 1 | 🆕 New | T-002 | ⬜ |
| T-007: Copy institution.js | 1 | 🆕 New | T-002 | ⬜ |
| T-008: Copy permission.js | 1 | 🆕 New | T-002 | ⬜ |
| T-009: Copy app.js | 1 | 🆕 New | T-002 | ⬜ |
| T-010: Barrel export index.js | 1 | 🆕 New | T-006..T-009 | ⬜ |
| T-011: Hapus workspace dari Core | 1 | 🔴 Breaking | T-010 | ⬜ |
| T-012: Redirect Inventory imports | 2 | 🔄 Refactor | T-010 | ⬜ |
| T-013: Verify build | 2 | ✅ Verify | T-012 | ⬜ |

**⚠️ Perhatian:** T-012 adalah **breaking change**. Semua import di Inventory harus diupdate.
**Checklist pre-merge:**
- [ ] `npm run build` di `packages/smart-core` sukses
- [ ] `npm run build` di `apps/inventory` sukses
- [ ] Halaman Dashboard, Barang, Supplier, Pembelian masih muncul
- [ ] Login sebagai admin & operator masih work

---

### SPRINT 3: SMART UI Extraction
**Durasi:** 2 hari
**Branch:** `epic-001/sprint-3-ui-extraction`
**Tujuan:** Ekstrak UI ke package + harmonisasi design token

| Task | Hari | Tipe | Dependensi | Status |
|---|---|---|---|---|
| T-014: Copy tokens/ | 1 | 🆕 New | T-003 | ⬜ |
| T-015: Copy components/ | 1 | 🆕 New | T-003 | ⬜ |
| T-016: Barrel export index.js | 1 | 🆕 New | T-014, T-015 | ⬜ |
| T-017: Workspace engine.js | 1 | 🆕 New | T-003 | ⬜ |
| T-018: Copy workspace vars | 1 | 🆕 New | T-003 | ⬜ |
| T-019: Redirect Inventory imports | 1 | 🔄 Refactor | T-016 | ⬜ |
| T-020: Verify build | 1 | ✅ Verify | T-019 | ⬜ |
| T-034: Tambah --surface token | 1 | 🔄 Refactor | T-014 | ⬜ |
| T-035: Fix card.css | 1 | 🔄 Refactor | T-034 | ⬜ |
| T-036: Fix stat-card.css | 1 | 🔄 Refactor | T-034 | ⬜ |
| T-037: Harmonize warehouse vars | 1 | 🔄 Refactor | T-034 | ⬜ |
| T-038: Harmonize corporate vars | 1 | 🔄 Refactor | T-034 | ⬜ |
| T-039: Fix default vars | 1 | 🔄 Refactor | T-034 | ⬜ |
| T-040: Fix main.css | 1 | 🔄 Refactor | T-034 | ⬜ |
| T-041: Verify visual | 1 | ✅ Verify | T-035..T-040 | ⬜ |

---

### SPRINT 4: Layout Engine
**Durasi:** 2 hari
**Branch:** `epic-001/sprint-4-layout-engine`
**Tujuan:** Pisahkan Layout Engine, integrasikan Inventory

| Task | Hari | Tipe | Dependensi | Status |
|---|---|---|---|---|
| T-021: Layout engine.js | 1 | 🆕 New | T-016 | ⬜ |
| T-022: Move Topbar | 1 | 🔄 Move | T-021 | ⬜ |
| T-023: Move Sidebar | 1 | 🔄 Move | T-021 | ⬜ |
| T-024: Shell.js | 1 | 🆕 New | T-022, T-023 | ⬜ |
| T-025: Update MainLayout | 1 | 🔄 Refactor | T-024 | ⬜ |
| T-026: Delete Layout.js (kosong) | 1 | 🗑️ Delete | T-025 | ⬜ |
| T-027: Verify build & visual | 1 | ✅ Verify | T-025, T-026 | ⬜ |
| T-028: Delete old core/ dir | 1 | 🗑️ Delete | T-012 | ⬜ |
| T-029: Delete old ui/ dir | 1 | 🗑️ Delete | T-019 | ⬜ |
| T-030: Delete old components/ dir | 1 | 🗑️ Delete | T-025 | ⬜ |
| T-031: Clean up main.js | 1 | 🔄 Refactor | T-028, T-029, T-030 | ⬜ |
| T-032: Update inventory package.json | 1 | 🔄 Refactor | T-031 | ⬜ |
| T-033: Full verification | 1 | ✅ Verify | T-032 | ⬜ |

**⚠️ SPRINT 4 ADALAH MOMENT KRITIS**
Ini adalah sprint di mana file-file lama dihapus. Sebelum T-028, T-029, T-030 dijalankan, pastikan:
- ✅ Build sukses
- ✅ Semua halaman Inventory berfungsi
- ✅ Backup via git commit

---

### SPRINT 5: Workspace & Template
**Durasi:** 2 hari
**Branch:** `epic-001/sprint-5-workspace-template`
**Tujuan:** Workspace Experience + App Template

| Task | Hari | Tipe | Dependensi | Status |
|---|---|---|---|---|
| T-058: Workspace engine.js | 1 | 🆕 New | T-017 | ⬜ |
| T-059: Workspace schema.js | 1 | 🆕 New | T-058 | ⬜ |
| T-060: default workspace.json | 1 | 🆕 New | T-059 | ⬜ |
| T-061: warehouse workspace.json | 1 | 🆕 New | T-059 | ⬜ |
| T-062: corporate workspace.json | 1 | 🆕 New | T-059 | ⬜ |
| T-063: Update layout engine | 1 | 🔄 Refactor | T-058 | ⬜ |
| T-064: Move menu.js | 1 | 🔄 Move | T-063 | ⬜ |
| T-050: Template package.json | 1 | 🆕 New | T-033 | ⬜ |
| T-051: Template index.html | 1 | 🆕 New | T-050 | ⬜ |
| T-052: Template vite.config.js | 1 | 🆕 New | T-050 | ⬜ |
| T-053: Template main.js | 1 | 🆕 New | T-050 | ⬜ |
| T-054: Template app.js | 1 | 🆕 New | T-050 | ⬜ |
| T-055: Template workspace.json | 1 | 🆕 New | T-059 | ⬜ |
| T-056: Template README.md | 1 | 🆕 New | T-050..T-055 | ⬜ |
| T-057: Verify template | 1 | ✅ Verify | T-056 | ⬜ |

---

## 📈 SPRINT TIMELINE

```
Sprint      Durasi   Tasks   Files       Status
─────────────────────────────────────────────────────
Sprint 1    2 hari   13      +13 files   ⬜ Monorepo + ADR
Sprint 2    2 hari    8      +5 files    ⬜ Core Extraction
Sprint 3    2 hari   15      +8 files    ⬜ UI Extraction + Harmonize
Sprint 4    2 hari   13      +4 files    ⬜ Layout Engine + Cleanup
Sprint 5    2 hari   15      +12 files   ⬜ Workspace + Template
─────────────────────────────────────────────────────
Total      10 hari   64      +42 files
          (2 minggu)        (+22 modified / 7 deleted)
```

### Effort Distribution

```
Sprint 1:  ████████████░░░░░░  20%  (13 tasks — mostly new files)
Sprint 2:  ████████░░░░░░░░░░  13%  (8 tasks — small but critical)
Sprint 3:  ██████████████░░░░  23%  (15 tasks — most refactoring)
Sprint 4:  ████████████░░░░░░  20%  (13 tasks — most deletions)
Sprint 5:  ██████████████░░░░  23%  (15 tasks — template + workspace)
```

### Risk Per Sprint

```
Sprint 1: 🟢 LOW     — Hanya bikin file baru, tidak ada perubahan existing
Sprint 2: 🔴 HIGH    — Breaking change: redirect imports + hapus workspace dari Core
Sprint 3: 🟡 MEDIUM  — Redirect imports UI. Risiko typo di path.
Sprint 4: 🔴 HIGH    — Menghapus file lama. Risiko dependency yang terlewat.
Sprint 5: 🟢 LOW     — Hanya bikin file baru + verify.
```

---

## 🧪 VERIFICATION CHECKLIST (Global)

Setiap task yang mengubah/menghapus file harus diverifikasi dengan:

```bash
# 1. Build package
cd /srv/packages/smart-core && npm run build
cd /srv/packages/smart-ui && npm run build

# 2. Build app
cd /srv/apps/inventory && npm run build

# 3. Dev server (manual test)
cd /srv/apps/inventory && npm run dev
# Buka browser → test: Dashboard, Barang, Supplier, Pembelian
# Test: Login sebagai admin, operator
# Test: Ganti workspace (default, warehouse, corporate)

# 4. Lint (jika sudah setup)
npm run lint
```

### Acceptance Criteria EPIC-001

- [ ] Monorepo structure dengan `packages/` dan `apps/`
- [ ] `@smart/core` bisa di-import oleh aplikasi manapun
- [ ] `@smart/ui` bisa di-import oleh aplikasi manapun
- [ ] Core **tidak bergantung** pada UI (tidak ada import `../../ui/`)
- [ ] Layout Engine terpisah dari Component Library
- [ ] Design Token konsisten (semua workspace pakai token references)
- [ ] `--card-bg` dan `--radius` terdefinisi di tokens
- [ ] Global CSS (`main.css`) menggunakan design tokens
- [ ] Inventory berjalan normal sebagai aplikasi pertama
- [ ] 7 ADR terdokumentasi di `docs/adr/`
- [ ] App template siap di `apps/_template/`
- [ ] Workspace Experience model: minimal CSS + layout + menu
- [ ] Tidak ada direktori kosong yang tidak jelas tujuannya

---

## 📝 CLOSING

### Command Sequence untuk Memulai

```bash
# 1. Buat branch epic
git checkout -b epic-001

# 2. Sprint 1
git checkout -b epic-001/sprint-1-monorepo-setup
# ... kerjakan T-001 sampai T-005 + T-042 sampai T-049
git add .
git commit -m "Sprint 1: Monorepo setup + ADR documentation"
git checkout epic-001
git merge epic-001/sprint-1-monorepo-setup

# 3. Sprint 2
git checkout -b epic-001/sprint-2-core-extraction
# ... kerjakan T-006 sampai T-013
git add .
git commit -m "Sprint 2: SMART Core extraction"
git checkout epic-001
git merge epic-001/sprint-2-core-extraction

# 4. Sprint 3
git checkout -b epic-001/sprint-3-ui-extraction
# ... kerjakan T-014 sampai T-020 + T-034 sampai T-041
git add .
git commit -m "Sprint 3: SMART UI extraction + token harmonization"
git checkout epic-001
git merge epic-001/sprint-3-ui-extraction

# 5. Sprint 4
git checkout -b epic-001/sprint-4-layout-engine
# ... kerjakan T-021 sampai T-033
git add .
git commit -m "Sprint 4: Layout Engine + Inventory integration"
git checkout epic-001
git merge epic-001/sprint-4-layout-engine

# 6. Sprint 5
git checkout -b epic-001/sprint-5-workspace-template
# ... kerjakan T-050 sampai T-057 + T-058 sampai T-064
git add .
git commit -m "Sprint 5: Workspace Experience + App Template"
git checkout epic-001
git merge epic-001/sprint-5-workspace-template

# 7. Final verification
npm run build  # Build semua packages & apps
npm run dev    # Manual test Inventory
```

---

**Status:** ⏳ Menunggu approval untuk memulai Sprint 1.
