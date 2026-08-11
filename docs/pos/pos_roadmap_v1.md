# POS.e-Profit V1
## Product Requirement Document (PRD)

**Document Version :** 1.0

**Product :** POS.e-Profit

**Based On :** SMART Inventory

**Target :** Freebuff Development Team

---

# Revision History

| Version | Date | Author | Description |
|----------|------|---------|-------------|
| 1.0 | 2026 | Smart Vision | Initial Product Requirement Document |
| 1.1 | 2026-08-10 | Freebuff | Sinkronisasi status implementasi (Void ✅, Return engine ✅ + dukungan `sumber=pos`, behavior-aware stok) + definisi resmi **Void vs Retur vs Koreksi** (§7.8.1) + referensi `pos-retur-koreksi.md` |
| 1.2 | 2026-08-10 | Freebuff | Audit final V1 — sinkron checklist Acceptance Criteria §18 (checklist tercentang sesuai implementasi live: sales-breakdown by item/category/cashier/payment, payment report, cashier report; item diskon = backlog; Hold (T5) & UI retur kasir (T13) = backlog butuh approval PO) |
| 1.3 | 2026-08-10 | Freebuff | T5 Hold/Resume DIIMPLEMENTASIKAN (M3-FIX v16, approval PO) — §7.5 diperbarui: status `held` (additive) + `POST /:id/hold` & `POST /:id/resume` (permission `pos.transaction.hold`) + filter `?status=held` + tombol/badge/modal di layar kasir; stok tidak berubah saat hold/resume; transaksi held tidak masuk laporan/omzet |

---

# Table of Contents

1. Executive Summary
2. Product Vision
3. Migration Strategy
4. Product Architecture & Master Platform Configuration (Part II, III, XIV)
5. Workspace POS (Part IV)
6. Dashboard (Part V)
7. POS Core (Part VI)
8. Master Item (Part VII)
9. Inventory Behavior (Part VIII)
10. Transaction Engine — Mixed Transaction (Part IX)
11. Inventory Integration (Part X)
12. Cashier & Shift / Payment (Part XI)
13. Reporting (Part XIII)
14. User & Permission (Part XII)
15. MVP Scope (Part XV)
16. Database & API Impact (Part XVI)
17. UI/UX Requirements (Part XVII)
18. Acceptance Criteria V1 (Part XVIII)
19. Freebuff Execution Rule (Part XIX)
20. Final V1 Delivery (Part XX)

# Golden Rules (Rule 1–20)

---

# 1. Executive Summary

POS.e-Profit merupakan aplikasi Point of Sales (POS) yang dikembangkan sebagai bagian dari ekosistem e-Profit Platform.

Berbeda dengan aplikasi POS pada umumnya, POS.e-Profit **tidak dibangun dari awal (from scratch)**, tetapi merupakan hasil pengembangan lanjutan dari SMART Inventory yang telah memiliki engine inventory, pembelian, penjualan, customer, supplier, serta reporting yang stabil.

Pendekatan ini dipilih agar:

- mempercepat proses pengembangan,
- mengurangi risiko bug,
- menjaga konsistensi business logic,
- mempermudah maintenance,
- mempermudah integrasi dengan modul lain.

POS.e-Profit ditujukan sebagai solusi universal yang dapat digunakan oleh berbagai jenis usaha seperti:

- Retail
- Minimarket
- Toko Kelontong
- Cafe
- Coffee Shop
- Restoran
- Bakery
- UMKM Food & Beverage

Seluruh jenis usaha tersebut menggunakan **engine yang sama**.

Perbedaan proses bisnis dikendalikan melalui **Inventory Behavior**, bukan dengan membuat aplikasi yang berbeda.

---

# 2. Product Vision

Visi utama POS.e-Profit adalah menjadi aplikasi Point of Sales yang sederhana digunakan, namun memiliki fondasi setara ERP sehingga mampu berkembang mengikuti pertumbuhan bisnis pelanggan.

Prinsip utama produk adalah:

> One POS Engine,
> Multiple Business Models.

Dengan prinsip tersebut satu engine POS dapat digunakan oleh berbagai sektor usaha hanya dengan mengubah perilaku (behavior) setiap item.

Contoh:

Aqua
Behavior : Trading

↓

stok Aqua berkurang

----------------------------------

Nasi Goreng

Behavior : Recipe

↓

stok Beras
stok Telur
stok Minyak berkurang

----------------------------------

Jasa Antar

Behavior : Service

↓

tidak mempengaruhi stok

Kasir tidak perlu memahami proses tersebut.

Kasir hanya menjual Item.

Engine menentukan perilaku transaksi.

---

# 3. Migration Strategy

## 3.1 Prinsip

POS.e-Profit wajib dikembangkan dengan mengkloning SMART Inventory.

Freebuff **tidak diperbolehkan membuat project baru**.

Seluruh pengembangan dilakukan di atas project SMART Inventory yang telah stabil.

Prinsip utama:

Reuse Before Rewrite.

Seluruh business logic yang sudah tersedia harus digunakan kembali semaksimal mungkin.

Rewrite hanya dilakukan apabila benar-benar diperlukan.

---

## 3.2 Modul yang Dipertahankan

Modul berikut **tidak boleh diubah** tanpa persetujuan Product Owner:

- Authentication
- Authorization
- Database
- Inventory Engine
- Purchasing Engine
- Customer Engine
- Supplier Engine
- Reporting Engine
- API Contract
- Permission Engine

Perubahan pada modul tersebut berpotensi mempengaruhi produk lain.

---

## 3.3 Modul yang Diubah

Workspace

Dashboard

Sidebar

Branding

Logo

Layout

Workflow Penjualan

User Experience

Kasir Interface

---

## 3.4 Branding

Clone SMART Inventory

↓

Rename

↓

POS.e-Profit

Domain:

pos.e-profit.id

---

## 3.5 Tujuan Kloning

Dengan strategi ini:

- waktu pengembangan lebih cepat,
- kualitas lebih stabil,
- maintenance lebih mudah,
- upgrade engine inventory otomatis dapat diwariskan ke POS.

## 3.6 Platform Architecture

POS.e-Profit merupakan bagian dari ekosistem e-Profit Platform.

Seluruh aplikasi dalam ekosistem e-Profit memiliki domain dan fungsi yang berbeda, namun tetap menggunakan arsitektur dan platform yang sama.

### Domain

| Aplikasi | Domain | Fungsi |
|----------|---------|--------|
| Master Platform | master.e-profit.id | Super Administrator Platform |
| Inventory | inv.e-profit.id | Warehouse & Inventory Management |
| POS | pos.e-profit.id | Point of Sales |
| Accounting | acc.e-profit.id | Accounting & Financial Report |

---

### Master Platform

Seluruh perusahaan (tenant) **tidak dibuat langsung melalui POS**.

Semua perusahaan dikelola melalui:

master.e-profit.id

Master Platform berfungsi sebagai pusat administrasi seluruh produk e-Profit.

Fungsi utama Master Platform:

- Registrasi perusahaan
- Aktivasi produk
- Aktivasi lisensi
- Pengaturan paket berlangganan
- Pengaturan Single Lokasi / Multi Lokasi
- Pengaturan jumlah gudang
- Pengaturan jumlah kasir
- Pengaturan modul yang diaktifkan
- Monitoring penggunaan aplikasi

Dengan pendekatan ini, seluruh produk e-Profit menggunakan tenant yang sama sehingga tidak terjadi duplikasi data perusahaan.

---

### POS Platform

pos.e-Profit berjalan secara penuh pada:

pos.e-profit.id

POS hanya menangani operasional penjualan.

POS **tidak memiliki menu pembuatan perusahaan**.

Saat pengguna login, POS hanya mengambil informasi perusahaan yang telah dibuat dan diaktifkan pada Master Platform.

---

### Inventory Platform

Inventory berjalan pada:

inv.e-profit.id

Inventory bertanggung jawab terhadap:

- Gudang
- Persediaan
- Pembelian
- Transfer Gudang
- Stok Opname
- Warehouse Management

POS akan menggunakan data inventory sesuai konfigurasi perusahaan.

---

### Sinkronisasi Platform

Master Platform

↓

Perusahaan

↓

Produk Aktif

↓

Inventory

↓

POS

↓

Accounting

Seluruh aplikasi menggunakan Company ID yang sama sehingga data dapat dipertukarkan tanpa proses migrasi.


# EPIC-001 : Platform Integration

## Objective

Mengintegrasikan POS.e-Profit ke dalam ekosistem SMART Platform tanpa membuat arsitektur baru.

POS harus menjadi bagian dari platform yang sudah ada, menggunakan tenant, autentikasi, dan konfigurasi yang sama dengan SMART Inventory.

---

## Task 1 : Clone SMART Inventory

- Clone repository SMART Inventory.
- Rename project menjadi POS.e-Profit.
- Workspace baru menggunakan branding POS.
- Domain target:
  - pos.e-profit.id

### Acceptance Criteria

- Project berhasil dikloning.
- Seluruh fitur Inventory tetap berjalan.
- Branding berubah menjadi POS.e-Profit.

---

## Task 2 : Integrasi dengan Master Platform

POS **tidak diperbolehkan** membuat perusahaan (tenant) sendiri.

Seluruh data perusahaan berasal dari:

master.e-profit.id

POS hanya membaca konfigurasi perusahaan yang telah dibuat oleh Super Administrator.

### Acceptance Criteria

- POS dapat membaca Company ID.
- POS dapat membaca License.
- POS dapat membaca konfigurasi perusahaan.
- POS tidak memiliki menu "Tambah Perusahaan".

---

## Task 3 : Company Configuration

Tambahkan konfigurasi perusahaan pada Master Platform.

Minimal konfigurasi:

- Nama Perusahaan
- Produk Aktif
- Business Type
- Single / Multi Lokasi
- Jumlah Gudang
- Jumlah Kasir
- Status Lisensi

### Acceptance Criteria

Konfigurasi tersebut dapat dibaca oleh Inventory dan POS.

---

## Task 4 : Product Activation

Master Platform harus mampu mengaktifkan produk secara terpisah.

Contoh:

☑ Inventory

☑ POS

☐ Accounting

☐ CRM

☐ HR

Produk yang tidak aktif tidak boleh dapat diakses oleh perusahaan.

---

## Task 5 : Business Type

Tambahkan Business Type pada Master Platform.

Contoh:

- Retail
- Cafe
- Restaurant
- Bakery
- Pharmacy
- Distributor
- Manufacturing

Business Type akan digunakan oleh POS untuk menentukan konfigurasi awal.

---

## Task 6 : Single / Multi Lokasi

Master Platform menjadi pusat pengaturan lokasi.

Jika:

Single Lokasi

↓

POS menyembunyikan:

- Transfer Gudang
- Pilih Gudang

Jika:

Multi Lokasi

↓

POS mengaktifkan:

- Transfer Gudang
- Pemilihan Gudang
- Multi Warehouse

---

## Task 7 : Product Configuration

Master Platform menjadi pusat konfigurasi seluruh produk.

Minimal konfigurasi:

- Inventory
- POS
- Accounting
- Digital Product
- AI Assistant

Masing-masing dapat diaktifkan atau dinonaktifkan tanpa mengubah aplikasi.

---

## Acceptance Criteria

✓ POS berjalan pada:

pos.e-profit.id

✓ Inventory berjalan pada:

inv.e-profit.id

✓ Super Administrator berjalan pada:

master.e-profit.id

✓ Semua menggunakan Company ID yang sama.

✓ Tidak ada duplikasi data perusahaan.

✓ Semua konfigurasi berasal dari Master Platform.


# Golden Rules

Dokumen ini merupakan pedoman utama pengembangan POS.e-Profit.

Seluruh implementasi yang dilakukan oleh Freebuff wajib mengikuti aturan berikut.

---

## Rule 1 - Clone, Don't Create

POS.e-Profit **WAJIB** dikembangkan dengan mengkloning SMART Inventory.

Dilarang membuat project baru dari nol.

Seluruh business logic yang telah stabil harus digunakan kembali.

---

## Rule 2 - Reuse Before Rewrite

Selalu utamakan penggunaan kembali (reuse) modul yang sudah ada.

Rewrite hanya diperbolehkan apabila:

- terdapat bug kritis,
- perubahan arsitektur telah disetujui Product Owner,
- atau memang tidak memungkinkan dilakukan melalui extension.

---

## Rule 3 - Do Not Break Inventory Engine

Core Engine SMART Inventory merupakan fondasi seluruh platform.

Freebuff dilarang mengubah business logic Inventory hanya untuk memenuhi kebutuhan POS.

Jika POS membutuhkan perilaku baru, implementasikan sebagai extension pada POS tanpa merusak Inventory Engine.

---

## Rule 4 - Master Platform is the Single Source of Truth

Seluruh data perusahaan berasal dari:

master.e-profit.id

POS maupun Inventory tidak diperbolehkan membuat atau mengelola data perusahaan secara mandiri.

Master Platform menjadi pusat:

- Company
- License
- Subscription
- Product Activation
- Business Configuration

---

## Rule 5 - One Company ID

Seluruh aplikasi menggunakan Company ID yang sama.

Contoh:

master.e-profit.id

↓

Company ID

↓

inv.e-profit.id

↓

pos.e-profit.id

↓

acc.e-profit.id

Tidak boleh ada Company ID baru pada masing-masing aplikasi.

---

## Rule 6 - One Authentication

Authentication dan Authorization harus menggunakan sistem yang sama.

Tidak diperbolehkan membuat sistem login baru khusus POS.

---

## Rule 7 - One Database Architecture

POS menggunakan struktur database yang sama dengan SMART Inventory.

Perubahan struktur database harus mempertimbangkan kompatibilitas dengan seluruh platform.

---

## Rule 8 - One Product Ecosystem

POS bukan aplikasi yang berdiri sendiri.

POS merupakan bagian dari e-Profit Platform.

Seluruh pengembangan harus mempertimbangkan integrasi dengan:

- Inventory
- Accounting
- AI Assistant
- Digital Product
- CRM
- HR
- Mobile App

---

## Rule 9 - Business Behavior, Not Business Application

Retail, Cafe, Restaurant, Bakery, Pharmacy, dan jenis usaha lainnya **tidak dibuat sebagai aplikasi yang berbeda**.

Perbedaan proses bisnis dikendalikan oleh:

Inventory Behavior

Contoh:

Trading

Recipe

Manufactured

Service

Digital (Roadmap)

Dengan demikian satu POS Engine dapat melayani berbagai sektor usaha.

---

## Rule 10 - Backward Compatibility

Seluruh perubahan wajib mempertahankan kompatibilitas dengan SMART Inventory.

Perubahan yang menyebabkan Inventory tidak dapat melakukan upgrade ke versi berikutnya tidak diperbolehkan.

---

## Rule 11 - MVP First

Target utama V1 adalah menghasilkan POS Core yang stabil.

Jangan menambahkan fitur di luar ruang lingkup MVP apabila dapat mengganggu stabilitas sistem.

---

## Rule 12 - Documentation First

Setiap fitur baru wajib memiliki:

- Business Rules
- UI Flow
- Database Impact
- API Impact
- Acceptance Criteria

Sebelum implementasi dilakukan.

Tidak diperbolehkan melakukan implementasi tanpa dokumentasi yang jelas.

---

## Rule 13 - Code Quality

Seluruh kode yang ditulis harus:

- Modular
- Reusable
- Maintainable
- Readable
- Testable

Menghindari duplikasi kode.

---

## Rule 14 - Future Ready

Seluruh desain V1 harus mempertimbangkan roadmap berikutnya:

- Recipe Engine
- Kitchen Display
- Digital Product Engine
- Accounting Integration
- AI Assistant
- Marketplace
- Mobile POS

Tanpa perlu melakukan redesign arsitektur.

---

## Rule 15 - Platform First, Feature Second

Setiap keputusan pengembangan wajib mengutamakan kepentingan platform dibandingkan kepentingan satu produk.

POS.e-Profit merupakan bagian dari e-Profit Platform sehingga seluruh perubahan harus mempertimbangkan dampaknya terhadap produk lain seperti SMART Inventory, Accounting, AI Assistant, CRM, HR, maupun modul yang akan dikembangkan di masa mendatang.

Freebuff tidak diperbolehkan mengambil keputusan teknis yang mengorbankan konsistensi arsitektur platform hanya untuk memenuhi kebutuhan jangka pendek pada POS.

Jika terdapat kebutuhan fitur baru yang belum didukung oleh platform, maka solusi yang dipilih harus:

- mempertahankan kompatibilitas dengan SMART Inventory,
- tidak merusak Core Engine,
- dapat digunakan kembali (reusable) oleh produk lain,
- mendukung pengembangan jangka panjang e-Profit Platform.

---

## Rule 16 - Engine First, UI Second

Pengembangan harus selalu dimulai dari business engine, kemudian dilanjutkan dengan workflow, dan terakhir user interface.

Urutan pengembangan yang wajib diikuti:

Business Rules

↓

Business Engine

↓

Database

↓

API

↓

Workflow

↓

User Interface

↓

User Experience

Dengan pendekatan ini, perubahan tampilan tidak akan mempengaruhi business logic yang telah stabil.

---

## Rule 17 - Configuration Driven

Perbedaan perilaku sistem harus dikendalikan melalui konfigurasi, bukan dengan membuat aplikasi atau source code yang berbeda.

Contoh konfigurasi:

- Business Type
- Inventory Behavior
- Single / Multi Lokasi
- Product Activation
- License
- User Role

Dengan pendekatan ini, satu source code dapat melayani berbagai jenis usaha.

---

## Rule 18 - One Engine, Multiple Behaviors

POS.e-Profit hanya memiliki satu Transaction Engine.

Engine tersebut harus mampu menangani berbagai jenis transaksi berdasarkan Inventory Behavior.

Contoh:

Trading
→ Mengurangi stok barang.

Recipe
→ Menjalankan Recipe Engine kemudian mengurangi bahan baku.

Manufactured
→ Mengurangi stok produk hasil produksi.

Service
→ Tidak mempengaruhi persediaan.

Digital (Roadmap)
→ Mengirim transaksi ke Digital Product Engine (Digiflazz/PPOB Provider).

Kasir tidak perlu mengetahui proses tersebut.

Kasir hanya menjual Item.

Engine menentukan perilaku transaksi secara otomatis.

---

## Rule 19 - Keep It Simple

Semua desain harus sederhana bagi pengguna.

Kompleksitas sistem diselesaikan pada level engine, bukan pada level user interface.

Target utama:

- Mudah dipelajari.
- Cepat digunakan.
- Sedikit klik.
- Responsif.
- Konsisten.

---

## Rule 20 - Every Feature Must Have Business Value

Tidak ada fitur yang dikembangkan hanya karena menarik secara teknis.

Setiap fitur baru wajib memiliki:

- tujuan bisnis yang jelas,
- manfaat bagi pengguna,
- dampak terhadap efisiensi operasional,
- dan roadmap implementasi.

Apabila suatu fitur tidak memberikan nilai bisnis yang nyata, maka fitur tersebut harus ditunda hingga memberikan manfaat yang dapat diukur.

---

# 4. Product Architecture (Part II & III)

## 4.1 Arsitektur Platform

```
                     e-Profit Platform
                           |
               +-----------+-----------+
               |                       |
        master.e-profit.id       Product Applications
        Master Platform                 |
               |              +----------+----------+
               |              |          |          |
               |             POS      Inventory   Accounting
               |              |          |
               |              |          |
               +----------- Company ID --+
```

| Aplikasi        | Domain             | Fungsi                                  |
|-----------------|--------------------|-----------------------------------------|
| Master Platform | master.e-profit.id | Superadmin / Platform Control Center    |
| Inventory       | inv.e-profit.id    | Inventory / Warehouse Management        |
| POS             | pos.e-profit.id    | Point of Sales                          |
| Accounting      | acc.e-profit.id    | Accounting & Financial Report (roadmap) |

## 4.2 Prinsip Arsitektur

1. **Master Platform adalah Single Source of Truth untuk Company.**
   - POS **tidak membuat** Company.
   - Inventory **tidak membuat** Company.
   - Seluruh aplikasi menggunakan **Company ID yang sama** (Rule 5).
2. **Authentication/Authorization mengikuti platform** (Rule 6) — satu sistem JWT + permission engine.
3. **Product activation dikendalikan dari Master Platform** (Rule 4, 17) — `Company.apps` + gate server.
4. **Business configuration dikendalikan dari Master Platform** — business type, lokasi, gudang, kasir, lisensi.

## 4.3 Master Platform Configuration (Part III)

Konfigurasi berikut **WAJIB dikendalikan dari master.e-profit.id** dan dibaca POS (tidak boleh hard-coded di POS):

| Konfigurasi             | Field (Company model) | Konsumen                             |
|-------------------------|-----------------------|--------------------------------------|
| Company                 | `code`, `name`        | Seluruh aplikasi (Company ID)        |
| License                 | `lisensiStatus`, `lisensiExpiresAt` | Gate lisensi (backlog enforcement) |
| Subscription            | Billing/Subscription (SP-029 M6) | Entitlement check (backlog)  |
| Product Activation      | `apps` (`inventory`, `pos`, `accounting`) | Gate login + impersonation |
| Business Type           | `businessType`        | Konfigurasi awal POS (default behavior) |
| Single/Multi Location   | `lokasiMode`          | Tampilkan/sembunyikan Transfer & Pilih Gudang |
| Warehouse Configuration | `jumlahGudang`        | Multi lokasi / jumlah gudang          |
| Cashier Configuration   | `jumlahKasir`         | Pembatasan jumlah kasir — **hanya role `kasir`** yang dihitung/diblokir (admin/operator tidak terbatas); enforce server (POST/PUT users) + UI role-aware (M3-FIX v17) |

**Extensibility (future-ready, Rule 14):** arsitektur ini siap diperluas ke AI, Digital Product, CRM, HR, dll. — cukup daftarkan slug aplikasi baru di Master Platform tanpa mengubah POS.

## 4.4 Business Configuration (Part XIV)

- Business Type hanya menentukan **konfigurasi/default behavior**, bukan aplikasi terpisah.
- Minimal: Retail, Cafe, Restaurant, Bakery, Other.
- Prinsip: **One POS Engine + Multiple Business Behaviors**.

---

# 5. Workspace POS (Part IV)

POS harus terasa sebagai **aplikasi tersendiri** meskipun berasal dari clone Inventory.

## 5.1 Menu POS (minimal)

| Menu        | Admin/Owner | Kasir | Read-only |
|-------------|:-----------:|:-----:|:---------:|
| Dashboard   | ✅           | ✅    | —         |
| Kasir       | ✅           | ✅    | —         |
| Item        | ✅           | ❌    | read-only utk kasir*
| Pembelian   | ✅           | ❌    | —         |
| Pelanggan   | ✅           | ✅    | —         |
| Supplier    | ✅           | ❌    | —         |
| Laporan     | ✅           | ❌    | —         |
| Pengaturan  | ✅           | ❌    | —         |
| Shift       | ✅           | ✅    | —         |

\* Kasir **tidak boleh** mengubah harga master / inventory config / company config (Part XII).

## 5.2 Aturan Menu

1. Menu yang hanya read-only: daftar (list) Item utk kasir — tanpa tombol ubah/hapus.
2. Menu yang **tidak boleh muncul pada role Kasir**: Pembelian, Supplier, Laporan, Pengaturan, Master (ubah).
3. Implementasi via **permission engine existing** (Rule 12/14) — tidak membuat permission engine baru.

---

# 6. Dashboard (Part V)

Dashboard harus **sederhana dan operasional** — bukan ERP dashboard yang kompleks.

## 6.1 Owner/Admin Dashboard

| Komponen              | Keterangan                                   |
|-----------------------|----------------------------------------------|
| Omzet hari ini        | Total penjualan (grandTotal) hari berjalan   |
| Jumlah transaksi      | Count transaksi sumber=pos hari ini          |
| Produk terlaris       | Top items by qty (periode pilihan)           |
| Stok menipis          | Barang dengan stok ≤ stok_minimum            |
| Metode pembayaran     | Breakdown per metode bayar                   |
| Penjualan per periode | Grafik/list penjualan (hari/bulan)           |
| Ringkasan kasir       | Per kasir: total transaksi & omzet           |
| Ringkasan shift       | Shift aktif / terakhir + total               |

## 6.2 Kasir Dashboard

| Komponen                    | Keterangan                        |
|-----------------------------|-----------------------------------|
| Shift aktif                 | Status shift saat ini + kas awal  |
| Total transaksi             | Hari berjalan                     |
| Total penjualan             | Hari berjalan                     |
| Shortcut transaksi baru     | Tombol langsung ke layar kasir    |
| Status kas                  | Kas awal + penjualan + selisih (dari shift) |
| Riwayat transaksi hari ini  | List transaksi hari berjalan      |

> Catatan penerapan: Pajak transaksi = **11%** (keputusan PO 2026-08-10); metode bayar cash/transfer/qris/card; diskon item & transaksi; catatan transaksi; barcode + scanner; multi price minimal (`harga_khusus`).

---

# 7. POS Core (Part VI)

Bagian **paling penting** V1.

## 7.1 Product Search

- Search berdasarkan: **nama**, **SKU**, **barcode**, **kategori**.
- Implementasi: extend search existing (nama/kode) + barcode + kategori.

## 7.2 Product Selection

- **Grid item** ✅ (existing).
- **Barcode scanner** — reuse komponen scanner existing (@smart/ui BarcodeScanner), tambah qty via scan berulang.
- **Quick add** ✅ (klik produk).
- Recent item / Favorite item — opsional (jika diperlukan).

## 7.3 Cart

- Tambah item ✅ · Ubah qty ✅ · Hapus item ✅ (existing).
- **Diskon item** (belum ada — engine sudah menerima `diskon` per item).
- **Diskon transaksi** (belum ada — engine sudah menerima `diskon` header).
- **Catatan transaksi** (engine sudah menerima `catatan`).

## 7.4 Pricing

- Harga retail ✅ (`harga_jual`).
- **Multi harga — minimal V1 (keputusan PO 2026-08-10)**: field `harga_khusus` per item (1 tier harga khusus), dipakai kasir bila terisi.
- Harga khusus sesuai konfigurasi — via `harga_khusus` item (additive).
- Diskon — lihat §7.3.

## 7.5 Transaction

| Operasi      | Status        | Catatan                                            |
|--------------|---------------|----------------------------------------------------|
| New          | ✅            | Layar kasir existing                               |
| Hold         | ✅            | Simpan keranjang sementara — transaksi dibuat (order) lalu `POST /api/penjualan/:id/hold` → status `held`; **stok TIDAK berubah**; permission `pos.transaction.hold` (kasir & admin). Tombol ⏸️ Hold di bill kasir (M3-FIX v16) |
| Resume       | ✅            | Lanjutkan transaksi ditahan — `POST /api/penjualan/:id/resume` (`held` → `order`) lalu items dimuat kembali ke keranjang & dokumen held dihapus; badge "N ditahan" + modal resume/hapus (M3-FIX v16). Harga = harga saat di-hold; stok/price validasi tetap berlaku saat checkout |
| Void         | ✅            | **Wajib mengikuti permission** — `pos.transaction.void` hanya Admin/Owner (keputusan C4); reversal stok trading + audit trail; lihat definisi §7.8.1 |
| Cancel       | ✅ (sebagian) | Hapus keranjang / hapus SO status order            |

> **Catatan Hold/Resume (M3-FIX v16):** transaksi `held` TIDAK masuk laporan/omzet (status bukan `paid`), tidak bisa di-void/diretur (bukan `paid`), dan bisa dihapus kapan saja (cancel). List transaksi ditahan: `GET /api/penjualan?status=held`.

## 7.6 Payment (Part XI — Payment)

Minimal: **Cash** ✅ (existing) · **Transfer** ⬜ · **QRIS** ⬜ · Card / metode lain sesuai engine.

Arsitektur payment harus **extensible**: field `metode_bayar` (enum) di Penjualan + dukungan engine (additive, backward compatible).

## 7.7 Receipt

Nomor transaksi ✅ · Tanggal ✅ · Kasir ✅ · Item ✅ · Qty ✅ · Harga ✅ · **Diskon** ⬜ · Pajak ✅ (jika aktif) · Total ✅ · **Payment method** ⬜ · Kembalian ✅.

## 7.8 Return

- **Reuse inventory return engine existing** (`retur-penjualan`) — JANGAN buat inventory return engine baru. ✅ Engine dipertahankan & di-extend additive (M3-FIX v11).
- Dukungan transaksi asal: Sales Order (`sumber: "so"`) **dan** transaksi kasir KWT (`sumber: "pos"`).
- Validasi: qty retur ≤ qty transaksi asal; transaksi asal berstatus `void` / `order` **ditolak** (400).
- Stok **behavior-aware**: saat retur dikonfirmasi (`draft → returned`), hanya item `trading` yang stoknya bertambah; service/recipe/manufactured/digital tidak memengaruhi stok (PRD §8–9, keputusan C1). Hapus retur berstatus `returned` → reversal stok trading.
- Workflow retur dari layar kasir (T13, backlog opsional V1) — V1 via halaman Penjualan tab "↩️ Retur Penjualan".

## 7.8.1 Definisi Void vs Retur vs Koreksi

| Aspek | **Void** (pembatalan) | **Retur** (pengembalian barang) | **Koreksi** (perbaikan) |
|-------|-----------------------|--------------------------------|-------------------------|
| Kapan | Transaksi kasir salah/keliru (salah item, salah harga, batal) | Pelanggan **mengembalikan barang fisik** setelah transaksi sah | Kesalahan data transaksi yang sudah lunas |
| Dokumen | Tidak ada dokumen baru — transaksi asal `status: "void"` | Dokumen baru `ReturPenjualan` (`RPJ-DDMMYYYY-NNNN`) | V1: tidak ada edit langsung transaksi lunas |
| Dampak stok | **Kembalikan** stok item trading (kebalikan penjualan) | **Tambahkan** stok item trading (barang kembali) | Ikut mekanisme void/retur |
| Riwayat | Transaksi tetap tampil dengan badge `Void` (audit trail) | Retur tercatat sebagai dokumen terpisah | Transaksi baru (hasil koreksi) tampil normal |
| Permission | `pos.transaction.void` — **Admin/Owner saja** (C4) | Akses Penjualan (`inventory.sales.*` / `pos.*`) | Mengikuti void/retur |
| Undo | Tidak bisa di-undo (audit permanen) | Bisa dibatalkan: hapus retur → reversal stok | — |
| Berlaku untuk | Transaksi kasir (`sumber=pos`, status `paid`) | SO **dan** transaksi kasir (KWT) | — |
| Endpoint | `POST /api/penjualan/:id/void` | CRUD `/api/retur-penjualan` | — |

**Keputusan PO (2026-08-10):** Void = batalkan transaksi kasir yang salah (hanya Admin/Owner). Retur = barang dikembalikan → stok trading bertambah. Koreksi V1 = **void transaksi lama lalu buat transaksi baru** — tidak ada endpoint edit untuk transaksi lunas (cegah manipulasi riwayat).

Dokumen lengkap (Business Rules, UI Flow, DB/API Impact, AC): `docs/pos/pos-retur-koreksi.md`.

---

# 8. Master Item (Part VII)

Gunakan master item yang berasal dari Inventory — **JANGAN membuat duplicate master item di POS**.

POS membaca item dari source of truth yang sudah digunakan Inventory (collection `Barang` existing).

| Field             | Status  | Keterangan                          |
|-------------------|---------|-------------------------------------|
| Item Code         | ✅      | `kode`                              |
| Barcode           | ⬜      | Tambah field `barcode` (additive)   |
| Name              | ✅      | `nama`                              |
| Category          | ✅      | `kategori`                          |
| Unit              | ✅      | `satuan`                            |
| Purchase Price    | ✅      | `harga_beli`                        |
| Selling Price     | ✅      | `harga_jual`                        |
| Multi Price       | ⬜      | Backlog (additive nanti)            |
| Tax               | ⬜      | Backlog — pajak transaksi utk V1    |
| Supplier          | ⬜      | Relasi optional (additive)          |
| Minimum Stock     | ✅      | `stok_minimum`                      |
| Inventory Behavior| ✅      | `behavior` (trading/service)        |
| Active/Inactive   | ✅      | `active`                            |

---

# 9. Inventory Behavior (Part VIII)

V1 harus menggunakan konsep behavior (Rule 9, 18).

## 9.1 Trading

Contoh: Aqua, Teh Botol, Rokok, Snack.

```
Sale → Decrease Item Stock
```

✅ Implemented (stok trading berkurang saat checkout POS, jasa tidak).

## 9.2 Recipe (Foundation V1)

Contoh: Kopi, Nasi Goreng, Mie Goreng.

```
Sale → Recipe → Consume Ingredients
```

V1 cukup menyediakan **foundation/interface** yang tidak mengunci implementasi Recipe Engine penuh (V2).

- Foundation minimal: `behavior` enum diperluas ke `recipe` + field referensi resep opsional + hook engine (NO-OP di V1).
- **Keputusan PO (2026-08-10): item recipe dijual TANPA mengurangi stok di V1** (seperti service) — tidak ada BOM sampai V2.
- Implementasi F&B advanced (BOM, modifier) masuk **V2**.

## 9.3 Service

Contoh: Jasa Antar, Jasa Service. Tidak mengurangi inventory. ✅ Implemented.

## 9.4 Manufactured

Siapkan behavior untuk roadmap produksi. Full production engine **bukan scope V1**. Enum disiapkan (`manufactured`) tanpa engine.

## 9.5 Digital

**Jangan implementasikan Digital Product pada V1.** Namun desain behavior harus memungkinkan V3:

```
Digital Product → Digital Product Engine → Provider → Digiflazz/PPOB
```

Enum behavior extensible (`digital` placeholder, tanpa engine).

---

# 10. Transaction Engine — Mixed Transaction (Part IX)

**WAJIB diuji.** Satu transaksi dapat berisi: Aqua (Trading), Kopi (Recipe), Nasi Goreng (Recipe), Jasa Antar (Service).

Engine harus menentukan behavior masing-masing item:

- Aqua → Trading → Stock -1 ✅
- Kopi → Recipe → Ingredient consumption (V1: foundation NO-OP)
- Nasi Goreng → Recipe → Ingredient consumption (V1: foundation NO-OP)
- Jasa Antar → Service → No stock impact ✅

**Kasir tidak perlu melakukan proses manual berbeda untuk setiap behavior** (Rule 19).

Existing: `splitPosItemsByBehavior` (trading vs service) — perluas ke recipe/manufactured/digital (NO-OP).

---

# 11. Inventory Integration (Part X)

## 11.1 Single Location (default UMKM)

```
Company → Main Store → Warehouse
```

Toko dapat sekaligus menjadi lokasi operasional dan gudang. POS hanya menggunakan warehouse yang ditentukan konfigurasi. ✅ (lokasiMode=single → sembunyikan Transfer/Pilih Gudang).

## 11.2 Multi Location

Jika Master Platform mengaktifkan Multi Location: POS mendukung location selection, warehouse selection, stock berdasarkan lokasi. ✅ engine existing (gudang, transfer).

**Transfer antar gudang bukan fokus POS V1** kecuali sudah tersedia dari Inventory Engine — JANGAN buat transfer engine baru di POS.

---

# 12. Cashier & Shift (Part XI)

## 12.1 Shift Opening

- Kas awal · Kasir · Waktu mulai. (`POST /api/pos/shift/open`)

## 12.2 During Shift

- Transaksi ✅ · Payment ✅ · Void ⬜ (admin, permission `pos.transaction.void`) · Return ⬜ · Cash movement jika engine mendukung.

## 12.3 Shift Closing

- Expected cash · Actual cash · Difference · Closing time · Cashier. (`POST /api/pos/shift/close`)

Hak akses harus diterapkan (permission `pos.shift.*`).

---

# 13. Reporting (Part XIII)

Gunakan reporting engine existing sebanyak mungkin.

## 13.1 Sales

- Sales today ✅ · Sales by period ✅ (`/api/laporan/sales` + date range) · Sales by item ⬜ · Sales by category ⬜ · Sales by cashier ⬜.

## 13.2 Payment

- Cash/Transfer/QRIS breakdown ⬜ (butuh field `metode_bayar`).

## 13.3 Inventory

- Stock ✅ · Low stock ✅ · Stock movement ✅ (`/api/laporan/mutation`).

## 13.4 Cashier / Shift

- Shift: Opening · Sales · Closing · Difference ⬜ (butuh model Shift).

---

# 14. User & Permission (Part XII)

Gunakan Permission Engine existing — JANGAN buat permission engine baru.

## 14.1 Role Admin

Akses: Dashboard, Kasir, Item, Pembelian, Customer, Supplier, Laporan, Pengaturan, Shift, Transaction management.

## 14.2 Role Kasir

Akses minimal: Dashboard, Kasir, Customer, Riwayat transaksi, Shift.

Kasir **tidak boleh**: mengubah harga master, mengubah inventory configuration, mengubah company configuration, mengelola user, mengubah permission.

**Keputusan PO (2026-08-10) — kasir sesuai PRD**: role kasir mendapat akses **Customer, Riwayat Transaksi (penjualan), Shift** selain Dashboard & Kasir. Tetap TANPA akses ubah master/settings/laporan.

Void transaksi: **hanya Admin/Owner** (permission `pos.transaction.void`).

---

# 15. MVP Scope (Part XV)

V1 (MVP) terdiri dari: Platform Integration ✅ · POS Core (search, cart, payment, receipt) · Master Item ✅ · Trading & Service Behavior ✅ · Recipe Foundation · Shift · Reporting dasar · Role Admin & Kasir.

## 15.1 Non-MVP / Backlog — JANGAN implementasi tanpa approval PO

| Versi | Fitur |
|-------|-------|
| V2 | Recipe Engine penuh, BOM, Modifier, Topping, Table Management, Kitchen Order, Kitchen Display, Production |
| V3 | Digital Product Engine (Pulsa, Paket Data, Token PLN, PPOB, Digiflazz), Provider abstraction |
| V4+ | Loyalty, Membership, Voucher, Gift Card, Delivery, Marketplace, Mobile POS, Offline Sync, Omnichannel |

Arsitektur V1 future-ready, tetapi fitur tersebut **tidak boleh mengganggu MVP**.

---

# 16. Database & API Impact (Part XVI)

Untuk setiap fitur baru dokumentasikan: Existing table reused? · New table required? · Existing API reused? · New API required? · Backward compatibility? · Migration required?

Prioritas: **Reuse existing → Extend existing → Create new**. JANGAN membuat duplicate entity jika sudah tersedia di SMART Inventory.

---

# 17. UI/UX Requirements (Part XVII)

POS harus terasa sebagai **aplikasi kasir modern**: Cepat · Sederhana · Sedikit klik · Keyboard friendly · Barcode friendly · Responsive.

Kasir **tidak boleh dipaksa memahami**: warehouse management, stock movement, accounting, recipe technical detail, platform configuration. Kompleksitas ditangani engine (Rule 19).

---

# 18. Acceptance Criteria V1 (Part XVIII)

V1 dianggap selesai hanya jika seluruh berikut terpenuhi:

## 18.1 Platform

- [ ] pos.e-profit.id berjalan ✅
- [ ] master.e-profit.id menjadi source of truth Company ✅
- [ ] Company ID konsisten ✅
- [ ] Product activation berjalan ✅
- [ ] License configuration terbaca ✅
- [ ] Business Type terbaca ✅
- [ ] Single/Multi Location terbaca ✅

## 18.2 POS

- [x] Login ✅ · Dashboard ✅ (kasir/owner versi) · Kasir ✅ · Barcode ✅ · Search ✅ · Cart ✅ · Multi price ✅ (harga_khusus, C2) · Discount ✅ (transaksi; item → backlog) · Payment ✅ (cash/transfer/qris/card) · Receipt ✅ (metode bayar & diskon) · **Hold ⬜ backlog (T5, butuh approval PO)** · Void ✅ (admin, permission `pos.transaction.void`) · Return ✅ (engine behavior-aware + `sumber=pos`; **UI tombol kasir ⬜ backlog T13**) · Shift ✅

## 18.3 Inventory

- [x] Trading behavior berjalan ✅ · Stock berkurang setelah sale ✅ · Recipe foundation ✅ (NO-OP V1, C1) · Service behavior ✅ · Inventory tetap konsisten ✅ (verifikasi live: stok Aquaviva 200→199)

## 18.4 Security

- [x] Admin role ✅ · Cashier role ✅ (Customer/Riwayat/Shift per C3) · Permission existing digunakan ✅ (tanpa permission engine baru) · Unauthorized action ditolak ✅ (void kasir diblokir, kuota gudang/kasir di-enforce server)

## 18.5 Reporting

- [x] Sales report ✅ (dasar + sales-breakdown by item/category/cashier/payment) · Payment report ✅ (per metode bayar) · Cashier report ✅ (per kasir/shift) · Stock report ✅ (stock, low stock, movement)

---

# 19. Freebuff Execution Rule (Part XIX)

Freebuff WAJIB menggunakan dokumen ini sebagai **Single Source of Truth**. Dilarang: membuat interpretasi fitur baru tanpa approval, memperluas scope V1 sendiri, mengubah Golden Rules, membuat duplicate engine, membuat duplicate master data, membuat authentication baru, membuat Company management di POS, mengubah Inventory Core tanpa approval.

Jika menemukan kebutuhan teknis yang tidak dijelaskan: **STOP → DOCUMENT FINDING → PROPOSE SOLUTION → WAIT FOR PRODUCT OWNER APPROVAL → IMPLEMENT**.

---

# 20. Final V1 Delivery (Part XX)

V1 hanya boleh dinyatakan **Production Ready** apabila:

```
Golden Rules + Platform Integration + POS Core + Inventory Integration
+ Cashier + Payment + Reporting + Security + Acceptance Test = POS.e-Profit V1
```

Setelah V1 Production Ready, **STOP pengembangan V2** sampai ada keputusan Product Owner. V2 dan seterusnya harus memiliki roadmap dan approval terpisah.

