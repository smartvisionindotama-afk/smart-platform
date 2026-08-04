# SP-026 — PACKAGE DOMAIN SEPARATION ARCHITECTURE

## SMART PLATFORM ARCHITECTURE STANDARD

Version: 1.0  
Status: APPROVED DESIGN  
Priority: HIGH  
Category: Architecture Refactoring  

---

# 1. PURPOSE

Dokumen ini mendefinisikan pemisahan antara:

- SMART Framework
- Business Domain Module
- Application Implementation

Tujuan utama:

1. Menjaga SMART Framework tetap generic dan reusable.
2. Mencegah business logic aplikasi masuk ke Framework.
3. Memungkinkan pengembangan multi aplikasi:
   - SMART Inventory
   - e-Profit
   - SMART POS
   - SITAMPAN
   - Santri Pintar
   - Future Applications

4. Memastikan setiap aplikasi dapat berkembang secara independen tetapi tetap menggunakan fondasi SMART Platform yang sama.

---

# 2. ARCHITECTURE PRINCIPLE

## Framework First

Setiap fitur harus dikategorikan:

Apakah fitur ini:


Reusable Across Applications


atau:


Specific Business Domain


Jika reusable:

Masuk Framework.

Jika spesifik bisnis:

Masuk Domain Package.

---

# 3. FINAL PACKAGE STRUCTURE

Struktur package resmi:


packages/

├── @smart/ui
│
├── @smart/inventory-ui
│
├── @smart/accounting-ui
│
└── @smart/pos-ui


---

# 4. @smart/ui

## Purpose

@smart/ui adalah SMART UI Framework.

Package ini berisi komponen dan engine yang dapat digunakan seluruh aplikasi.

---

## Allowed Content

@smart/ui hanya boleh berisi:


components

layout

theme

design-system

form-engine

table-engine

modal-engine

notification-engine

dashboard-engine

navigation-engine

auth-ui

platform-ui


---

# 5. @smart/ui PROHIBITED CONTENT

@smart/ui DILARANG memiliki:


Barang

Pembelian

Penjualan

Jurnal

Kasir

Gudang

Stock

Invoice

Laporan Keuangan

Pelanggan

Supplier


Karena semua itu adalah Business Domain.

---

# 6. @smart/inventory-ui

## Purpose

Reference Implementation untuk SMART Inventory.

Package ini berisi seluruh UI Business Module Inventory.

---

## Content:


dashboard

barang

kategori

gudang

rak

pembelian

penjualan

transfer

stock-opname

retur

laporan inventory


---

## Responsibility

@smart/inventory-ui bertanggung jawab terhadap:

- inventory workflow
- inventory business rules
- inventory page
- inventory form
- inventory transaction UI

---

# 7. @smart/accounting-ui

## Purpose

Business Module untuk e-Profit.

---

## Content:


chart-of-account

journal

ledger

cash-flow

financial-report

tax

budgeting

AI-accounting-assistant


---

## Responsibility

Mengelola seluruh UI dan workflow akuntansi.

Tidak boleh dimasukkan ke:


@smart/ui


---

# 8. @smart/pos-ui

## Purpose

Business Module untuk SMART POS.

---

## Content:


cashier

sales-order

payment

receipt

customer

product-display

promotion

inventory-sync


---

# 9. APPLICATION STRUCTURE

Setiap aplikasi menggunakan kombinasi package.

Contoh:

---

## SMART Inventory


apps/inventory

uses:

@smart/ui

@smart/inventory-ui


---

## e-Profit


apps/e-profit

uses:

@smart/ui

@smart/accounting-ui


---

## SMART POS


apps/pos

uses:

@smart/ui

@smart/pos-ui


---

# 10. DEPENDENCY RULE

Aturan dependency:


Application

  ↓

Domain Package

  ↓

SMART Framework


---

Contoh:

BENAR:


apps/inventory

↓

@smart/inventory-ui

↓

@smart/ui


---

SALAH:


@smart/ui

↓

@smart/inventory-ui


Framework tidak boleh mengetahui domain aplikasi.

---

# 11. PUBLIC SDK RULE

Setiap package hanya memiliki public API.

Contoh:


@smart/ui

exports:

SMART.UI.Button

SMART.UI.Table

SMART.UI.Modal

SMART.UI.Layout


---


@smart/inventory-ui

exports:

InventoryDashboard

BarangPage

PembelianPage

PenjualanPage


---

Internal implementation harus private.

---

# 12. MIGRATION PLAN

## Phase 1

Create package:


packages/inventory-ui


---

## Phase 2

Move Inventory modules:

From:


packages/smart-ui/src/modules/

barang

pembelian

penjualan

laporan

transfer


To:


packages/inventory-ui/src/modules/


---

## Phase 3

Clean @smart/ui

Remove:


inventory business logic


---

## Phase 4

Update Application Dependency.

Before:


apps/inventory

↓

@smart/ui


After:


apps/inventory

↓

@smart/inventory-ui

↓

@smart/ui


---

# 13. MIGRATION RULE

Selama proses migrasi:

Dilarang:

- rewrite total code
- mengubah business logic
- mengubah database structure
- menambah fitur baru

Fokus:


Separation Only


---

# 14. SUCCESS CRITERIA

SP-026 dianggap selesai apabila:

## Framework


@smart/ui


tidak memiliki business domain.

---

## Inventory


@smart/inventory-ui


berisi seluruh modul Inventory.

---

## Dependency

Seluruh aplikasi mengikuti:


Application

↓

Domain Package

↓

SMART Framework


---

# 15. FINAL ARCHITECTURE

             SMART PLATFORM


                 apps

inventory e-profit pos

|                |                |


↓                ↓                ↓

inventory-ui accounting-ui pos-ui

             @smart/ui
          SMART FOUNDATION

---

# 16. GOVERNANCE RULE

Setiap package baru harus melalui evaluasi:

Apakah:


Framework Capability


atau:


Business Domain Capability


Keputusan harus mengikuti prinsip:

> Framework menyediakan kemampuan.
>
> Domain Package menyediakan bisnis.

---

END OF DOCUMENT