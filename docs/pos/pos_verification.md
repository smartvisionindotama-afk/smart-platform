# POS.e-Profit — Verifikasi Sinkronisasi Data Contract Model Barang (POS ↔ Inventory)

| Field       | Value                                                        |
|-------------|--------------------------------------------------------------|
| Dokumen     | `docs/pos/pos_verification.md`                               |
| Tujuan      | Sinkronisasi data contract model `Barang` POS dengan Inventory (`harga_khusus`, `barcode`, `behavior`) |
| Tanggal     | 2026-08-11                                                   |
| Status      | ✅ **TERPENUHI tanpa perubahan kode** — model POS sudah memiliki ketiga field sesuai acceptance criteria |
| Instruksi   | Update **hanya** `apps/pos/server/models/Barang.js`; jangan ubah model Inventory, route, frontend, API contract, auth, entitlement, DB connection, atau POS transaction logic; tanpa refactor yang tidak diperlukan |

> **Kesimpulan singkat:** `apps/pos/server/models/Barang.js` **sudah** memiliki `harga_khusus`,
> `barcode`, dan `behavior` dengan definisi **persis sama** dengan acceptance criteria.
> Tidak ada baris kode yang diubah — mengubahnya hanya untuk "melakukan perubahan" akan
> melanggar instruksi *"jangan melakukan refactor yang tidak diperlukan"*.
> Belum di-commit (sesuai instruksi).

---

## 1. File yang Terlibat

| File | Peran | Perubahan |
|------|-------|-----------|
| `apps/pos/server/models/Barang.js` | Model Barang aplikasi POS | **Tidak diubah** — sudah memiliki ketiga field (status git: `??` / untracked) |
| `apps/inventory/server/models/Barang.js` | Model Barang aplikasi Inventory | **Tidak diubah** (sesuai instruksi) |

⚠️ **Catatan penting (premis prompt terbalik):** instruksi menyebut ketiga field tersebut
"sudah tersedia pada model Inventory" — faktanya kondisi repo saat ini adalah **kebalikannya**:
ketiga field ada di model **POS**, sedangkan **model Inventory belum memilikinya**.
Sesuai instruksi, model Inventory **tidak diubah**.

---

## 2. Diff Perbandingan Schema (Inventory vs POS)

```diff
--- apps/inventory/server/models/Barang.js
+++ apps/pos/server/models/Barang.js
@@ -11,10 +11,22 @@
     gudang: { type: String, default: "" },
     harga_beli: { type: Number, default: 0 },
     harga_jual: { type: Number, default: 0 },
+    // SP-027 PRE-M5 round 6 (PRD V1): harga khusus (1 tier multi price) —
+    // dipakai layar kasir bila terisi (> 0), fallback harga_jual. Additive.
+    harga_khusus: { type: Number, default: 0 },
+    // PRD V1 (POS Core): barcode item — untuk search & scanner kasir.
+    barcode: { type: String, default: "" },
     stok: { type: Number, default: 0 },
     stok_minimum: { type: Number, default: 0 },
-    // SP-029 M3 — foto produk (opsional, dipakai layar kasir POS).
-    // Additive — konsisten dengan apps/pos/server/models/Barang.js.
+    // SP-029 M3 — tipe barang (Inventory Behavior, PRD V1):
+    //   trading      → fisik, kurangi stok saat terjual
+    //   service      → jasa, TIDAK memakai stok
+    //   recipe       → resep (V1: dijual tanpa kurangi stok; engine penuh V2)
+    //   manufactured → produksi (placeholder, engine V2)
+    //   digital      → produk digital (placeholder, engine V3)
+    // Backward compatible (enum diperluas, bukan diganti).
+    behavior: { type: String, default: "trading", enum: ["trading", "service", "recipe", "manufactured", "digital"] },
+    // SP-029 M3 — foto produk (opsional, dipakai layar kasir).
     foto: { type: String, default: "" },
     deskripsi: { type: String, default: "" },
     active: { type: Boolean, default: true },
```

---

## 3. Acceptance Criteria — Kesesuaian Model POS (Sudah Terpenuhi)

```js
// Acceptance criteria (dari prompt)
harga_khusus: { type: Number, default: 0 },
barcode: { type: String, default: "" },
behavior: {
  type: String,
  default: "trading",
  enum: ["trading", "service", "recipe", "manufactured", "digital"]
}
```

| Field | Definisi di `apps/pos/server/models/Barang.js` | Hasil |
|-------|-----------------------------------------------|-------|
| `harga_khusus` | `{ type: Number, default: 0 }` | ✅ Cocok persis |
| `barcode` | `{ type: String, default: "" }` | ✅ Cocok persis |
| `behavior` | `{ type: String, default: "trading", enum: ["trading", "service", "recipe", "manufactured", "digital"] }` | ✅ Cocok persis |

> Klausul *"Gunakan definisi persis seperti model Inventory apabila terdapat perbedaan kecil"*
> tidak berlaku untuk ketiga field ini karena **model Inventory tidak memilikinya sama sekali**
> (lihat §1). Definisi yang dipakai merujuk acceptance criteria — sudah cocok persis.

**Kompatibilitas runtime (kedua app memakai DB/collection yang sama):**
- Ketiga field bersifat **additive** (bukan pengganti) → dokumen Barang lama tanpa field tersebut tetap valid.
- `behavior` memakai **enum yang diperluas** (bukan diganti) → backward compatible.
- Frontend kasir POS sudah memakai ketiga field: search/scan barcode
  (`apps/pos/src/pages/pos/index.js`), harga khusus member (`harga_khusus`), dan behavior
  recipe/no-stock (`pos-transaction.js`).

---

## 4. Hasil Verification Commands

### 4.1 Syntax check
```bash
$ node --check apps/pos/server/models/Barang.js
# → OK (exit 0)

$ node --check apps/inventory/server/models/Barang.js
# → OK (exit 0)
```

### 4.2 Build workspace POS
Workspace `pos` **terdaftar** di root `package.json`
(`workspaces: ["packages/*","apps/*"]` + script `build:pos`), sehingga command dari prompt
dipakai langsung tanpa mengubah konfigurasi workspace.

```bash
$ npm run --workspace=pos build
# > pos@0.0.0 build
# > vite build
#
# vite v8.1.4 building client environment for production...
# transforming...✓ 230 modules transformed.
# dist/index.html                                   1.67 kB │ gzip:   0.58 kB
# dist/assets/index-BwGOkVmm.css                   48.38 kB │ gzip:   8.51 kB
# dist/assets/index-B3n0Gswu.js                 1,116.87 kB │ gzip: 271.35 kB
# ✓ built in 923ms
```

### 4.3 Test server POS yang relevan
```bash
$ npx vitest run apps/pos/server/__tests__/pos-transaction.test.js apps/pos/server/__tests__/pos-gudang.test.js

# ✓ apps/pos/server/__tests__/pos-gudang.test.js (11 tests)
# ✓ apps/pos/server/__tests__/pos-transaction.test.js (25 tests)
#
# Test Files  2 passed (2)
#      Tests  36 passed (36)
```

---

## 5. Ringkasan

| Aspek | Hasil |
|-------|-------|
| File yang berubah | **Tidak ada** (model POS sudah memenuhi kriteria) |
| Diff schema | POS = Inventory + `harga_khusus`, `barcode`, `behavior` (additive) |
| Acceptance criteria | ✅ 3/3 cocok persis |
| `node --check` | ✅ OK (POS & Inventory) |
| Build workspace `pos` | ✅ Berhasil (923ms, 230 modules) |
| Test server POS | ✅ 36/36 passed |
| Model Inventory | Tidak diubah (sesuai instruksi) |
| Commit | **Belum** (sesuai instruksi) |

---

## 6. Rekomendasi Tindak Lanjut (opsional, butuh persetujuan)

- **Additive ke Inventory:** jika ingin kedua model benar-benar identik, tambahkan
  `harga_khusus`, `barcode`, `behavior` ke `apps/inventory/server/models/Barang.js`
  (additive, backward compatible) — **tidak dilakukan** karena dilarang instruksi.
- Pastikan file `apps/pos/server/models/Barang.js` yang masih *untracked* ikut di-commit
  pada milestone berikutnya.
