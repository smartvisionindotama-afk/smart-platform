# SP-025 MIGRATION REPORT — DOMAIN PACKAGE SEPARATION

**Task:** SP-025 Implementation — Domain Package Separation
**Date:** 2026-08-04
**Status:** ✅ DONE

---

## Before

```
packages/
└── smart-ui                         (@smart/ui)
    └── src/modules/
        ├── dashboard/               ← Inventory dashboard (jumlah barang, pembelian, penjualan, stok)
        ├── barang/                  ← Inventory business module
        ├── pembelian/               ← Inventory business module
        ├── penjualan/               ← Inventory business module
        ├── transfer/                ← Inventory business module
        ├── laporan/                 ← Inventory business module
        ├── master-crud/             ← Framework (generic CRUD engine)
        ├── settings/                ← Framework (role/permission/user/company)
        ├── platform/                ← Framework (platform dashboard & login)
        └── auth/                    ← Framework (login/register/reset-password)
```

Aplikasi `apps/inventory` mengimpor seluruh module bisnis langsung dari `@smart/ui`:

```
apps/inventory  →  @smart/ui  (mengandung business domain Inventory)
```

---

## After

```
packages/
├── smart-ui                         (@smart/ui)          → Framework ONLY
│   └── src/modules/
│       ├── master-crud/             ← Framework: generic CRUD engine
│       ├── settings/                ← Framework: role/permission/user/company
│       ├── platform/                ← Framework: platform dashboard & login
│       └── auth/                    ← Framework: login/register/reset-password
│
└── smart-inventory-ui               (@smart/inventory-ui) → Inventory Domain Package
    └── src/modules/
        ├── barang/
        ├── pembelian/
        ├── penjualan/
        ├── transfer/
        ├── laporan/
        └── dashboard/
```

Dependency arah baru (sesuai RULE 6 & SP-026 §10):

```
apps/inventory
      ↓
@smart/inventory-ui
      ↓
@smart/ui
```

Framework (`@smart/ui`) **tidak lagi** mengimpor / mengetahui domain Inventory.

---

## Files Moved

Dari `packages/smart-ui/src/modules/` → `packages/smart-inventory-ui/src/modules/`:

| Module | File |
|---|---|
| barang | `packages/smart-inventory-ui/src/modules/barang/index.js` |
| pembelian | `packages/smart-inventory-ui/src/modules/pembelian/index.js` |
| penjualan | `packages/smart-inventory-ui/src/modules/penjualan/index.js` |
| transfer | `packages/smart-inventory-ui/src/modules/transfer/index.js` |
| laporan | `packages/smart-inventory-ui/src/modules/laporan/index.js` |
| dashboard | `packages/smart-inventory-ui/src/modules/dashboard/index.js` |

Dibuat baru (RULE 7 — Public SDK):

| File | Keterangan |
|---|---|
| `packages/smart-inventory-ui/package.json` | Manifest package `@smart/inventory-ui` |
| `packages/smart-inventory-ui/src/index.js` | Public SDK entry |

---

## Files Modified (Import Changes)

### 1. Modul yang dipindah — import internal `../../index.js` → `@smart/ui`

| File | Perubahan |
|---|---|
| `packages/smart-inventory-ui/src/modules/barang/index.js` | `../../index.js` → `@smart/ui` |
| `packages/smart-inventory-ui/src/modules/pembelian/index.js` | `../../index.js` → `@smart/ui`; `../../components/scanner/scanner.js` → `@smart/ui` |
| `packages/smart-inventory-ui/src/modules/penjualan/index.js` | `../../index.js` → `@smart/ui`; `../../components/scanner/scanner.js` → `@smart/ui` |
| `packages/smart-inventory-ui/src/modules/transfer/index.js` | `../../index.js` → `@smart/ui`; `../../components/scanner/scanner.js` → `@smart/ui` |
| `packages/smart-inventory-ui/src/modules/laporan/index.js` | `../../index.js` → `@smart/ui` |
| `packages/smart-inventory-ui/src/modules/dashboard/index.js` | (tidak ada import smart-ui; hanya JSDoc `@module` diperbarui) |

JSDoc `@module` pada keenam modul diperbarui dari `@smart/ui/modules/*` → `@smart/inventory-ui/modules/*`.

### 2. `packages/smart-ui` — pembersihan framework

| File | Perubahan |
|---|---|
| `packages/smart-ui/src/index.js` | Hapus ekspor: `export * from "./modules/dashboard"`, `BarangModule`, `PembelianModule`, `PenjualanModule`, `TransferModule`, `LaporanModule`. `CrudModule` tetap dipertahankan. |
| `packages/smart-ui/package.json` | Hapus `exports` untuk `./modules/dashboard`, `./modules/pembelian`, `./modules/barang`. |

### 3. `apps/inventory` — consumer diarahkan ke domain package

| File | Perubahan |
|---|---|
| `apps/inventory/package.json` | Tambah dependency `"@smart/inventory-ui": "1.0.0"` |
| `apps/inventory/src/pages/barang/index.js` | `BarangModule` dari `@smart/ui` → `InventoryBarang` dari `@smart/inventory-ui` |
| `apps/inventory/src/pages/pembelian/index.js` | `PembelianModule` dari `@smart/ui` → `InventoryPembelian` dari `@smart/inventory-ui` |
| `apps/inventory/src/pages/penjualan/index.js` | `PenjualanModule` dari `@smart/ui` → `InventoryPenjualan` dari `@smart/inventory-ui` |
| `apps/inventory/src/pages/transfer/index.js` | `TransferModule` dari `@smart/ui` → `InventoryTransfer` dari `@smart/inventory-ui` |
| `apps/inventory/src/pages/report/index.js` | `LaporanModule` dari `@smart/ui` → `InventoryReports` dari `@smart/inventory-ui` |
| `apps/inventory/src/pages/dashboard/index.js` | `DashboardModule` dari `@smart/ui/modules/dashboard` → `InventoryDashboard` dari `@smart/inventory-ui` |

> Catatan: import aplikasi menggunakan alias (`InventoryBarang as BarangModule`) sehingga **seluruh kode halaman tidak berubah** — sesuai RULE 1 (tidak mengubah business logic).

### 4. `package-lock.json`

Dibuat ulang via `npm install` untuk meregistrasi workspace package baru `@smart/inventory-ui`.

---

## Public SDK (`@smart/inventory-ui`)

`packages/smart-inventory-ui/src/index.js` mengekspor hanya nama publik (RULE 7):

```
InventoryBarang       ← BarangModule
InventoryPembelian    ← PembelianModule
InventoryPenjualan    ← PenjualanModule
InventoryTransfer     ← TransferModule
InventoryDashboard    ← DashboardModule
InventoryReports      ← LaporanModule
```

> **Catatan keputusan:** RULE 7 mencantumkan 5 nama SDK (Barang, Pembelian, Penjualan, Dashboard, Reports). `InventoryTransfer` ikut diekspor karena RULE 3 secara eksplisit memindahkan modul `transfer` dan RULE 8 mensyaratkan aplikasi tetap berjalan — tanpa ekspor ini halaman Transfer akan rusak. Internal helper & private utility tidak diekspor.

---

## Validation Result

| Check | Result |
|---|---|
| `npm install` | ✅ PASS |
| `npm run build:inventory` (vite build) | ✅ **PASS** — `✓ built in 703ms` |
| `npm test` (vitest) | ✅ **PASS** — 21 files, 509 tests, 0 failures |

### Checklist RULE 8

1. **SMART Inventory tetap berjalan** — ✅ Build sukses, seluruh halaman (barang, pembelian, penjualan, transfer, laporan, dashboard) ter-import dari `@smart/inventory-ui`.
2. **Tidak ada import broken** — ✅ Tidak ada referensi `@smart/ui/modules/{barang,pembelian,penjualan,transfer,laporan,dashboard}` tersisa (kecuali sudah diperbarui).
3. **Tidak ada module inventory di smart-ui** — ✅ `packages/smart-ui/src/modules/` hanya berisi `auth`, `master-crud`, `platform`, `settings`; tidak ada import ke modul inventory.
4. **Tidak ada perubahan business behavior** — ✅ Hanya MOVE + RESTRUCTURE + UPDATE IMPORT; isi fungsi, API contract, dan workflow tidak diubah.

### Catatan lint

ESLint melaporkan error `no-undef` (`Event`, `confirm`) dan sejumlah warning di dalam modul yang dipindah (mis. `transfer/index.js`). Seluruhnya **pre-existing** pada kode yang dipindahkan apa adanya dan **tidak diperbaiki** karena di luar scope tugas ini (RULE 1 — jangan melakukan bug fixing; tugas ini murni pemisahan arsitektur).

---

## Scope Compliance

- ✅ MOVE / RESTRUCTURE / UPDATE IMPORT only
- ✅ Tidak ada perubahan business logic, API contract, database structure
- ✅ Tidak ada redesign / optimization / bug fixing / database migration
- ✅ Framework (`@smart/ui`) bersih dari business domain Inventory
- ✅ Dependency satu arah: `inventory-ui → smart-ui`

END OF REPORT
