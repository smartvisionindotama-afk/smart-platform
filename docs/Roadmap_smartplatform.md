# SMART PLATFORM
## PROJECT RESUME & EXECUTION GUIDE
### Version 2.0
### Status : ACTIVE DEVELOPMENT
### Priority : FRAMEWORK STABILIZATION

---

# CURRENT MISSION

SMART Framework sedang memasuki fase stabilisasi arsitektur.

Fokus utama saat ini BUKAN menambah fitur SMART Inventory, melainkan membangun Enterprise Application Development Platform yang stabil, reusable, scalable, dan dapat digunakan oleh seluruh aplikasi PT SMART VISION INDOTAMA.

SMART Inventory berfungsi sebagai **Reference Implementation** dari SMART Framework.

Seluruh perubahan pada Inventory harus bertujuan untuk memvalidasi dan menguji kemampuan Framework.

---

# DEVELOPMENT PRINCIPLE

## Framework First

Selalu tanyakan terlebih dahulu:

> Apakah fitur ini dapat digunakan oleh aplikasi lain?

Jika YA:

Implementasikan terlebih dahulu di Framework.

Jika TIDAK:

Implementasikan di Inventory.

### Status Implementasi (2026-08-13, M6-FIX v7)

Refactor Framework First pertama telah diterapkan penuh di seluruh platform
(POS, Inventory, Console) — perilaku identik, murni struktural:

1. **Util global → `@smart/core` Utils** (satu sumber kebenaran, via facade
   `SMART.Utils`):
   - Format angka: `formatRupiah` (tanpa simbol), `formatRupiahID` (Rp…),
     `formatNumber`, `formatDecimal`, `formatThousand`/`unformatThousand`,
     `parseIdNumber`
   - Format tanggal: `formatDate` ("13 Agu 2026"), `formatDateID`
     ("Kamis, 13 Agustus 2026"), `formatDateTime`, `timeAgo`
   - Escape HTML: `esc`/`escHtml`/`escAttr` (anti-XSS)
2. **~20 definisi duplikat dihapus** — `esc`/`escHtml` (settings, auth,
   master-crud, smart-inventory-ui, halaman POS/Inventory/Console),
   `formatRupiah` (barang-data pos & inv), `formatDate`/`formatDateID`/
   `formatDateTime` (penjualan, transfer, pembelian, laporan, inventory page),
   `fmtNum`/`fmtRupiah`/`formatThousand`/`unformatThousand`/`timeAgo` —
   semuanya kini import/re-export dari `@smart/core`.
3. **Anti double-read scan kamera di `BarcodeScanner`** (class scanner
   framework) — berlaku otomatis untuk SEMUA pemakai: kasir, member,
   master barang (pos & inv), pembelian, penjualan/SO, transfer.
4. **Verifikasi**: test 864/864, build pos+inventory+console ✓, 0 duplikat
   fungsi tersisa, lint bersih (hanya baseline pre-existing), bundle live
   byte-identik dengan dist di 3 domain.

Aturan bagi pengembang: jika menemukan fungsi utilitas/komponen UI yang
mulai di-copy ke lebih dari satu aplikasi/modul — HENTIKAN copy-paste,
pindahkan ke framework (smart-core Utils / smart-ui components), lalu
import dari sana.

---

## Thin Application

Inventory hanya berisi:

- Business Process
- Business Rules
- Business Workflow
- Business Pages

Inventory TIDAK BOLEH memiliki:

- Authentication
- Permission Engine
- Session Management
- Company Context
- Repository Engine
- MongoDB Logic
- API Layer
- Branding
- Workspace
- Theme Engine
- UI Component
- Audit
- Impersonation

Semua harus berada di SMART Framework.

---

# SMART FRAMEWORK

SMART Framework adalah fondasi seluruh aplikasi perusahaan.

Target pengguna Framework:

- SMART Inventory
- e-Profit
- SMART POS
- SITAMPAN
- Santri Pintar
- Desa Insight
- SMART WMS
- Future Applications

---

# FRAMEWORK PACKAGES

packages/

smart-core

smart-ui

smart-data

smart-api

smart-security

smart-config

Setiap package hanya memiliki SATU Public SDK.

Implementasi internal bersifat private.

### smart-core Utils (Public SDK — Framework First)

Util lintas aplikasi diekspor dari `@smart/core` (`packages/smart-core/src/utils/`)
dan di-agregasi di facade `SMART.Utils`:

- `format.js` — `formatRupiah`, `formatRupiahID`, `formatNumber`,
  `formatDecimal`, `formatThousand`, `unformatThousand`, `parseIdNumber`
- `escape.js` — `esc`, `escHtml`, `escAttr`
- `date.js` — `formatDate`, `formatDateID`, `formatDateTime`, `timeAgo`

Aplikasi TIDAK BOLEH mendefinisikan ulang util ini — selalu import dari
`@smart/core` (pola: `import { esc, formatDate } from "@smart/core";`).

---

# PUBLIC SDK

Target akhir Framework.

Programmer aplikasi hanya mengenal:

SMART.Session

SMART.Company

SMART.DB

SMART.API

SMART.UI

SMART.Permission

SMART.Platform

SMART.Audit

SMART.Impersonation

Tidak boleh mengakses implementasi internal package.

---

# FACADE ARCHITECTURE

Setiap package menggunakan Facade Pattern.

Contoh:

Company

Session

DB

API

UI

Permission

Platform

Audit

Impersonation

Seluruh helper, manager, validator, storage, context, repository internal disembunyikan dari programmer aplikasi.

---

# SESSION ARCHITECTURE

Session menjadi pusat seluruh Context.

SMART.Session

user

company

application

workspace

theme

locale

authenticated

Seluruh Repository mengambil Context dari Session.

---

# MULTI COMPANY

Repository tidak menerima companyId.

Repository otomatis membaca:

SMART.Session.company.id

Kemudian otomatis menambahkan:

companyId

createdBy

updatedBy

createdAt

updatedAt

Programmer aplikasi tidak perlu mengelola companyId.

---

# DATABASE

Database menggunakan MongoDB.

Aplikasi TIDAK BOLEH menggunakan MongoDB secara langsung.

Semua akses database menggunakan:

SMART.DB

Repository Layer

---

# API

Seluruh komunikasi backend menggunakan:

SMART.API

Tidak boleh ada fetch() langsung.

---

# UI

Seluruh UI berasal dari SMART.UI.

Minimal:

PageContainer

Modal

Dialog

Sidebar

Topbar

Notification

Loading

Table

Form

Button

Input

Select

Card

StatCard

Inventory hanya menggunakan component.

---

# COMPANY

Company menjadi pusat Branding.

Company memiliki:

Nama

Kode

Jenis Company

Logo

Theme

Workspace

Branding

Company Type:

- PT / CV / Perorangan
- BUMDes
- Koperasi
- Pesantren
- Pemerintah
- Lainnya

Logo Company otomatis digunakan oleh Sidebar.

---

# PERMISSION

Permission menggunakan Namespace.

Contoh:

inventory.dashboard.view

inventory.barang.read

inventory.barang.create

inventory.barang.update

inventory.barang.delete

settings.company.manage

settings.user.manage

settings.role.manage

settings.permission.manage

---

# PLATFORM

SMART Platform mengelola:

Application Registry

Company Registry

Workspace

Subscription

License

SuperAdmin

Application Switching

Company Switching

Login As Company Admin

---

# SUPER ADMIN

SuperAdmin berada DI LUAR seluruh aplikasi.

Dashboard SuperAdmin berada pada:

app.smartvindo.com

SuperAdmin memilih:

Application

↓

Company

↓

Login As Company Admin

Setelah Login As Company Admin:

Seluruh transaksi menjadi transaksi milik Company tersebut.

SuperAdmin TIDAK mengelola transaksi perusahaan.

Semua transaksi tetap menjadi tanggung jawab Admin Company.

---

# APPLICATION DOMAIN

Dashboard SuperAdmin

app.smartvindo.com

Application:

inventory.e-profit.id

e-profit.id

sitampan.e-profit.id

santripintar.e-profit.id

dan subdomain aplikasi lainnya.

Authentication menggunakan Session bersama.

---

# CURRENT PRIORITY

Priority 1

Framework Stabilization

Priority 2

Enterprise SDK

Priority 3

Reference Implementation

Priority 4

Production Ready

Priority 5

SDK Freeze v1.0

---

# CURRENT OBJECTIVE

Bangun Framework yang:

Reusable

Scalable

Maintainable

Enterprise Ready

Developer Friendly

Application Agnostic

---

# CODING RULES

WAJIB

✓ Framework First

✓ Facade Pattern

✓ Thin Application

✓ Clean Architecture

✓ SOLID

✓ Single Responsibility

✓ Dependency Injection

✓ Composition Over Inheritance

✓ Repository Pattern

✓ Multi Company

✓ Session Driven

✓ Namespace Permission

✓ Enterprise Quality

---

# DILARANG

✗ Business Logic aplikasi di Framework

✗ MongoDB langsung dari aplikasi

✗ fetch() langsung

✗ Company Context manual

✗ Duplicate Code

✗ Hardcoded Company ID

✗ Hardcoded Permission

✗ Hardcoded Branding

✗ Hardcoded Theme

✗ Hardcoded Workspace

✗ Import langsung ke helper internal package

---

# SUCCESS CRITERIA

SMART Framework menjadi Enterprise Application Development Platform.

SMART Inventory menjadi Reference Implementation.

Seluruh aplikasi berikutnya cukup menggunakan Framework tanpa membangun ulang Authentication, Permission, Session, Database, API, UI, Branding, maupun Company Management.

Framework harus menjadi aset utama PT SMART VISION INDOTAMA.

---

# EXECUTION RULE

Setiap kali memulai pekerjaan:

1. Baca dokumen ini terlebih dahulu.
2. Evaluasi apakah pekerjaan termasuk Framework atau Inventory.
3. Jika reusable, implementasikan di Framework.
4. Jika khusus bisnis Inventory, implementasikan di Inventory.
5. Pastikan Inventory tetap dapat berjalan sebagai Reference Implementation.
6. Perbarui execution_status.md setelah pekerjaan selesai.

Dokumen ini adalah acuan utama seluruh pengembangan SMART Platform.