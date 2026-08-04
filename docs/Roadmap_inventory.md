SMART Inventory — Execution Roadmap

Author: Chief Solution Architect, PT SMART VISION INDOTAMA
Version: 1.0
Status: Active Development
Target: MVP Production Ready (7 Hari)

1. OBJECTIVE

SMART Inventory merupakan aplikasi Inventory & Warehouse Management berbasis SMART Platform.

Target utama:

Inventory dapat digunakan oleh klien.
Semua transaksi utama berjalan.
Framework ikut tervalidasi tanpa menghambat delivery.
2. IMPLEMENTATION STRATEGY

Implementasi menggunakan prinsip:

Working Software Every Day

Setiap hari aplikasi harus tetap bisa dijalankan.

Tidak boleh ada commit yang menyebabkan aplikasi rusak.

3. SIDEBAR STRUCTURE

SMART Inventory — Sidebar Navigation

├── Dashboard
│
├── Master
│
├── Transaction
│
├── Inventory
│
├── Finance
│
├── Report
│
└── Settings
      ├── Company
      ├── Institution
      ├── Workspace
      ├── User
      ├── Role
      ├── Permission
      ├── Menu
      ├── Numbering
      ├── Warehouse
      ├── Inventory
      ├── Tax
      ├── Currency
      ├── Theme
      └── Audit Log

4. MODULE STRUCTURE
SMART Inventory

├── Authentication
├── Dashboard
│
├── Master Data
│     ├── Barang
│     ├── Kategori
│     ├── Satuan
│     ├── Gudang
│     ├── Supplier
│     ├── Pelanggan
│     ├── User
│     ├── Role
│     └── Permission
│
├── Transaction
│     ├── Pembelian
│     ├── Retur Pembelian
│     ├── Penjualan
│     ├── Retur Penjualan
│     ├── Transfer Gudang
│     ├── Mutasi
│     ├── Stock Adjustment
│     ├── Stock Opname
│     ├── Permintaan Barang
│     └── Penerimaan Barang
│
├── Inventory
│     ├── Stock Card
│     ├── Stock Balance
│     ├── Stock Movement
│     ├── Batch
│     ├── Lot
│     ├── Minimum Stock
│     └── Multi Warehouse
│
├── Finance
│     ├── Hutang
│     ├── Piutang
│     ├── Pembayaran
│     └── Cash Flow (optional)
│
├── Reports
│     ├── Stock
│     ├── Inventory Value
│     ├── Purchase
│     ├── Sales
│     ├── Mutation
│     ├── Opname
│     ├── Supplier
│     └── Customer
│
└── Administration
      ├── Profile
      ├── Setting
      ├── Audit Log
      └── Workspace
5. DEVELOPMENT PHASE
PHASE 1 — Foundation

Target:

Aplikasi dapat login dan menampilkan dashboard.

Checklist

Login
Session
Sidebar
Dashboard
Workspace
MongoDB Connection
Repository Layer
CRUD Base

Status:

Priority : CRITICAL
PHASE 2 — Master Data

Target:

Semua master dapat diinput.

Module

Barang
Kategori
Satuan
Gudang
Supplier
Customer
User
Role

Semua wajib memiliki:

List

Create

Edit

Delete

Search

Pagination

Filter

Status

Priority : CRITICAL
PHASE 3 — Purchase

Target

Pembelian selesai.

Flow

PO

↓

Receive

↓

Stock Bertambah

↓

Hutang Bertambah
PHASE 4 — Sales

Target

Penjualan selesai.

Flow

Sales

↓

Stock Berkurang

↓

Piutang Bertambah
PHASE 5 — Warehouse

Target

Semua proses gudang berjalan.

Module

Transfer Gudang

Mutasi

Stock Adjustment

Stock Opname

Stock Card

Stock History
PHASE 6 — Reports

Target

Semua laporan utama selesai.

Module

Stock

Purchase

Sales

Inventory Value

Mutation

Supplier

Customer
PHASE 7 — Administration

Target

Sistem siap dipakai.

Module

Role Permission

Audit Log

Setting

Profile
6. MULTI-COMPANY DATA ISOLATION

Setiap data WAJIB terikat dengan perusahaan (companyCode) dari user yang sedang login.

Aturan:

- Setiap dokumen MongoDB WAJIB memiliki field `companyCode`
- Setiap operasi CREATE WAJIB menyertakan `companyCode` dari session user aktif
- Setiap operasi READ/UPDATE/DELETE WAJIB memfilter berdasarkan `companyCode`
- Auto-numbering (nomor PO, invoice, dll) WAJIB unik per companyCode, BUKAN global
- Tidak boleh ada data dari perusahaan A yang terlihat oleh perusahaan B
- Repository Layer otomatis menambahkan companyCode (via SMART.Session / BaseRepository)
- API endpoint wajib membaca header `x-company-code` untuk scoping

Pelanggaran terhadap aturan ini menyebabkan kebocoran data antar perusahaan dan merupakan CRITICAL BUG.

7. DATABASE COLLECTION
users

roles

permissions

categories

units

products

warehouses

suppliers

customers

purchases

purchase_items

sales

sales_items

stock_cards

stock_adjustments

stock_opnames

stock_transfers

inventory_logs

audit_logs

settings
8. UI STANDARD

Seluruh halaman WAJIB menggunakan SMART UI.

AppShell

Sidebar

Topbar

Table

Modal

Toast

Tabs

Card

Pagination

Badge

Avatar

Alert

EmptyState

Skeleton

Breadcrumb
9. DEFINITION OF DONE

Inventory dinyatakan selesai apabila:

✅ Login berjalan

✅ Dashboard selesai

✅ Semua Master CRUD

✅ Pembelian berjalan

✅ Penjualan berjalan

✅ Mutasi berjalan

✅ Opname berjalan

✅ Laporan berjalan

✅ Hak Akses berjalan

✅ MongoDB berjalan

✅ Repository Pattern digunakan

✅ Semua menu dapat diakses

✅ Tidak ada error Javascript

✅ Lint bersih

✅ Build sukses

10. EXECUTION ORDER (MANDATORY)

FreeBuff WAJIB mengerjakan modul sesuai urutan berikut dan tidak boleh melompat tanpa instruksi.

Sprint	Modul	Status
Sprint 1	Login, Dashboard, Sidebar, Workspace, MongoDB, Repository	✅
Sprint 2	Barang, Kategori, Satuan	✅
Sprint 3	Gudang, Supplier, Pelanggan	✅
Sprint 4	User, Role, Permission	✅
Sprint 5	Pembelian	✅
Sprint 6	Penjualan	✅
Sprint 7	Transfer, Mutasi, Adjustment, Opname	🔄 Transfer ✅ • Opname ✅ • Mutasi ⬜ • Adjustment ⬜
Sprint 8	Laporan	✅ Laporan Stok ✅ • Pembelian ✅ • Penjualan ✅ • Nilai Inventori ✅ • Mutasi ✅ • Supplier ✅ • Customer ✅
Sprint 9	Audit Log, Setting, Final Testing	⬜