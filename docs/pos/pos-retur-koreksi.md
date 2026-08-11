# POS.e-Profit V1 — Retur & Koreksi Transaksi

| Field       | Value                                                        |
|-------------|--------------------------------------------------------------|
| Dokumen     | `docs/pos/pos-retur-koreksi.md`                              |
| Berdasarkan | `pos_roadmap_v1.md` (PRD V1 — Part VI §6.5/§7.8, Part VIII, Golden Rules) |
| Tanggal     | 2026-08-10                                                    |
| Status      | ✅ Diimplementasikan (M3-FIX v11) — reuse engine Inventory `retur-penjualan` |

> **Prinsip eksekusi (Part XIX):** engine retur **TIDAK dibuat ulang** — yang sudah ada
> (clone Inventory `routes/retur-penjualan.js` + model `ReturPenjualan`) **dipertahankan**;
> perubahan hanya **extend additive**: behavior-aware stok, dukungan transaksi POS (KWT),
> dan validasi void. Fitur yang sudah PASS tidak disentuh.

---

## 1. Definisi: Void vs Retur vs Koreksi

Tiga mekanisme berbeda untuk transaksi yang bermasalah — jangan dicampur:

| Aspek | **Void** (pembatalan) | **Retur** (pengembalian barang) | **Koreksi** (perbaikan) |
|-------|-----------------------|--------------------------------|-------------------------|
| Kapan | Transaksi salah/keliru saat itu juga (salah item, salah harga, pelanggan batal) | Pelanggan **mengembalikan barang fisik** setelah transaksi sah | Ada kesalahan data pada transaksi yang sudah lunas |
| Dokumen | Tidak ada dokumen baru — transaksi asal ditandai `status: "void"` | Dokumen baru `ReturPenjualan` (`RPJ-DDMMYYYY-NNNN`) | **V1: tidak ada edit langsung** transaksi lunas |
| Dampak stok | **Kembalikan** stok item trading (kebalikan penjualan) | **Tambahkan** stok item trading (barang kembali) | Ikut mekanisme void/retur |
| Payment | Tidak ada pengembalian uang otomatis (manual) | Tidak ada (retur barang; refund manual) | — |
| Riwayat | Transaksi **tetap tampil** dengan badge `Void` (audit trail) | Retur tercatat sebagai dokumen terpisah | Transaksi baru (hasil koreksi) tampil normal |
| Permission | `pos.transaction.void` — **Admin/Owner saja** (keputusan PO C4) | `inventory.sales.*` / `pos.*` (akses Penjualan) | Mengikuti void/retur |
| Undo | Tidak bisa di-undo (audit permanen) | Dapat dibatalkan: hapus retur → reversal stok | — |
| Berlaku utk | Transaksi **kasir saja** (`sumber=pos`, status `paid`) | SO **dan** transaksi kasir (KWT) | — |
| Endpoint | `POST /api/penjualan/:id/void` | CRUD `/api/retur-penjualan` | — |

**Aturan bisnis V1 (keputusan PO 2026-08-10):**
1. **Void** = batalkan transaksi kasir (KWT) yang salah. Hanya Admin/Owner. Stok trading dikembalikan; item service/recipe tidak. Tidak menghapus dokumen — status `void` + `voidedAt/By/Reason`.
2. **Retur** = pelanggan mengembalikan barang → stok trading bertambah saat retur dikonfirmasi (`draft → returned`). Berlaku untuk SO maupun transaksi POS.
3. **Koreksi** di V1 = **void transaksi lama lalu buat transaksi baru**. Tidak ada endpoint edit untuk transaksi lunas (mencegah manipulasi riwayat). Engine BOM/editing lanjutan = V2.

---

## 2. Business Rules

| # | Rule | Detail |
|---|------|--------|
| BR-1 | Referensi transaksi asal | Retur boleh merujuk SO (`sumber=so`) atau transaksi kasir KWT (`sumber=pos`) via `idSO`/`nomorSO`; mode manual (tanpa referensi) tetap didukung |
| BR-2 | Qty retur ≤ sisa qty asal (kumulatif) | Validasi per item: qty baru + total qty retur lain (draft & returned) utk transaksi yang sama ≤ qty asal — **anti retur ganda** (stok tidak menggelembung); item yang tidak ada di transaksi asal → ditolak (kecuali mode manual) |
| BR-3 | Void dilarang diretur | Transaksi asal berstatus `void` → retur ditolak (`Transaksi asal sudah di-void`) |
| BR-4 | Status asal minimal paid | Transaksi asal berstatus `order` → ditolak (SO harus sudah delivered/invoiced/paid; KWT lahir paid) |
| BR-5 | Behavior-aware stok | Saat `returned`: **hanya item `trading`** yang stoknya bertambah. Service/recipe/manufactured/digital tidak memengaruhi stok (PRD V1 §8–9, keputusan C1) |
| BR-6 | Lifecycle retur | `draft` (bisa diedit/dihapus) → `returned` (barang diterima, stok bertambah). `returned` tidak bisa kembali ke draft |
| BR-7 | Hapus retur | Boleh semua status; **persist delete dulu, lalu** reversal stok trading (jika `returned`) — gagal delete = stok tidak berubah (konsistensi) |
| BR-8 | Sumber dicatat | Field `sumber` (`so`/`pos`) disimpan untuk pelaporan |
| BR-9 | Koreksi V1 | Tidak ada edit langsung transaksi lunas — gunakan void (kasir) lalu transaksi ulang |
| BR-10 | Audit | Semua aksi (create/update/delete/status) dicatat ke `ActivityLog` + `createdBy`/`updatedBy` |

---

## 3. UI Flow

### 3.1 Retur (halaman Penjualan → tab "↩️ Retur Penjualan")
```
Halaman Penjualan (riwayat transaksi)
  └─ Tab "↩️ Retur Penjualan" (modul shared @smart/inventory-ui)
       ├─ List retur (nomor RPJ, tanggal, pelanggan, status, total) + search/pagination
       ├─ "+ Buat Retur" → form:
       │    · Mode: referensi transaksi (pilih SO/KWT) ATAU manual
       │    · Items: kode, nama, satuan, qty, harga → subtotal otomatis
       │    · Simpan → status draft
       ├─ Draft → tombol "✅ Konfirmasi Retur" (draft → returned, stok trading +)
       └─ Semua status → tombol "🗑️ Hapus" (returned → stok trading di-reversal)
```
> Alur kasir (T13, P3 backlog): tombol "Retur" pada struk/kwitansi di layar kasir
> menyusul — engine sudah siap; V1 cukup via halaman Penjualan (manual/Pilih transaksi).

### 3.2 Void (halaman Penjualan → daftar transaksi)
```
Halaman Penjualan (list) — hanya untuk transaksi sumber=pos & status paid
  └─ tombol "🚫 Void" (hanya tampil utk user dgn permission pos.transaction.void)
       └─ Modal konfirmasi + alasan (wajib) → status "void" + stok trading kembali
```
> Kasir TIDAK melihat tombol Void (permission gate) — per C4.

### 3.3 Koreksi (V1)
```
Transaksi salah (sudah paid) → Void (Admin/Owner) → buat transaksi baru yang benar.
```

---

## 4. Database Impact (semua additive)

| Koleksi | Perubahan | Catatan |
|---------|-----------|---------|
| `returpenjualans` | + field `sumber` (`"so"`/`"pos"`, default `"so"`) | Tidak ada index baru (companyCode+nomor sudah ada) |
| `penjualans` | Tidak berubah (void fields sudah ada sejak T4) | `status` enum sudah memuat `"void"` |
| `barangs` | Tidak berubah | `behavior` sudah ada |
| `activitylogs` | Tidak berubah | Reuse |

**Backward compatibility:** dokumen retur lama tanpa `sumber` → dianggap `"so"` (default schema). Tidak ada migrasi data.

---

## 5. API Impact

| Route | Method | Deskripsi | Perubahan |
|-------|--------|-----------|-----------|
| `/api/retur-penjualan` | GET | List retur (search/pagination/company) | Tidak berubah |
| `/api/retur-penjualan` | POST | Buat retur (validasi transaksi asal, void diblokir) | **Extend:** validasi void + set `sumber` |
| `/api/retur-penjualan/:id` | GET/PUT/DELETE | Detail/edit(draft)/hapus | **Extend:** DELETE reversal behavior-aware |
| `/api/retur-penjualan/:id/status` | PATCH | `draft → returned` | **Extend:** stok bertambah hanya utk item trading |
| `/api/penjualan/:id/void` | POST | Void transaksi kasir (permission `pos.transaction.void`) | Tidak berubah (sudah ada sejak T4) |

**Error codes baru:** `400 Transaksi asal sudah di-void — tidak bisa diretur` · `400 Transaksi asal masih berstatus Order` · `400 Item X tidak ditemukan di transaksi asal` · `400 Qty retur X (N) melebihi sisa qty transaksi asal (S dari T — R sudah diretur)` (kumulatif) · `400 Qty setiap item harus lebih dari 0`.

**Kontrak request (POST retur):**
```json
{
  "tanggal": "2026-08-10",
  "nomorSO": "KWT-10082026-0001",
  "idSO": "<penjualanId>",
  "pelanggan": "UMUM",
  "pelangganNama": "Pelanggan Umum",
  "items": [{ "kode": "BRG-001", "nama": "Aqua", "satuan": "Botol", "qty": 1, "harga": 5000 }],
  "catatan": ""
}
```

---

## 6. Acceptance Criteria (diverifikasi)

| # | Kriteria | Cara verifikasi |
|---|----------|-----------------|
| AC-1 | Retur SO: stok trading bertambah saat `returned`, sesuai qty | Unit test `returStockItems` + smoke API |
| AC-2 | Retur item service/recipe → stok TIDAK berubah | Unit test `returStockItems` (mixed behavior) |
| AC-3 | Retur transaksi POS (KWT, `sumber=pos`) bisa dibuat & `sumber` tercatat | Unit test + inspeksi dokumen |
| AC-4 | Retur terhadap transaksi void → ditolak 400 | Validasi route `validateItemsAgainstSo` |
| AC-5 | Qty retur > qty asal → ditolak 400 | Validasi route |
| AC-5b | Retur ganda (total qty melebihi qty asal) → ditolak 400 (kumulatif) | Validasi route `validateItemsAgainstSo` (akumulasi draft+returned) |
| AC-5c | Qty item ≤ 0 → ditolak 400 | Validasi route (POST & PUT) |
| AC-6 | Hapus retur `returned` → stok trading di-reversal | Route DELETE (persist dulu, lalu reversal behavior-aware) |
| AC-6 | Hapus retur `returned` → stok trading di-reversal | Route DELETE (behavior-aware) |
| AC-7 | Void hanya utk `sumber=pos` & `paid`; permission `pos.transaction.void` | Route penjualan (sudah PASS — regresi) |
| AC-8 | Definisi Void/Retur/Koreksi terdokumentasi | Dokumen ini + PRD |
| AC-9 | Tidak ada duplicate engine & tidak menyentuh fitur PASS | Audit diff + full regression |

---

## 7. Verifikasi & Status Test

| Cek | Hasil |
|-----|-------|
| Unit test | Full suite **800/800** hijau (pos-transaction 13 — returStockItems baru) |
| Lint | 0 error baru |
| Build | pos + inventory + console ✓ |
| Live | pos.e-profit.id health 200, HSTS aktif |

---

## 8. Backlog (di luar V1 — butuh approval)

- T13: tombol Retur langsung dari layar kasir / struk (engine siap)
- Refund otomatis (kembalikan uang via metode bayar asal)
- Edit langsung transaksi lunas (koreksi terarah) — V2
- Retur parsial multi-transaksi / klaim garansi
