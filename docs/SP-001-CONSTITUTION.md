# SP-001 - SMART PLATFORM CONSTITUTION

> **Document Code** : SP-001  
> **Document Name** : SMART Platform Constitution  
> **Version** : 1.0  
> **Status** : Official  
> **Owner** : PT SMART VISION INDOTAMA  
> **Last Update** : August 2026  

---

# PURPOSE

Dokumen ini merupakan konstitusi utama SMART Platform.

Dokumen ini mendefinisikan:

- Prinsip dasar pembangunan SMART Platform.
- Aturan pengembangan aplikasi.
- Batas tanggung jawab Platform, Framework, dan Application.
- Standar pengambilan keputusan arsitektur.

Seluruh pengembangan SMART Platform wajib mengikuti dokumen ini.

---

# SMART PLATFORM DEFINITION

SMART Platform adalah Enterprise Application Platform yang menjadi fondasi seluruh aplikasi digital PT SMART VISION INDOTAMA.

SMART Platform bukan hanya kumpulan aplikasi.

SMART Platform adalah ekosistem yang terdiri dari:

```
Platform

↓

Framework

↓

Application

↓

Business Process

↓

Business Value
```

---

# CORE VISION

SMART Platform dibangun dengan prinsip:

> Build the Platform, not only the Application.

Artinya:

Kami tidak membangun aplikasi secara terpisah.

Kami membangun fondasi yang memungkinkan banyak aplikasi berkembang secara konsisten.

---

# PLATFORM LAYER

SMART Platform memiliki tiga lapisan utama.

```
                SMART PLATFORM

                      │

              SMART FRAMEWORK

                      │

              APPLICATION LAYER
```

---

# LAYER RESPONSIBILITY

## 1. SMART PLATFORM

SMART Platform bertanggung jawab terhadap kemampuan yang bersifat global.

Contoh:

- Application Management
- Company Management
- Authentication
- User Management
- Permission Management
- Deployment
- Monitoring
- Environment Management
- Platform Configuration
- Administration

Platform menjadi pusat kendali seluruh ekosistem.

---

## 2. SMART FRAMEWORK

SMART Framework adalah fondasi teknis yang digunakan seluruh aplikasi.

Framework menyediakan kemampuan reusable.

Contoh:

- UI Component
- Session Context
- Repository
- Database Access
- API Client
- Permission SDK
- Theme Engine
- Workspace Engine
- Audit
- Logger

Framework tidak memiliki business logic aplikasi.

---

## 3. APPLICATION

Application hanya berisi kebutuhan bisnis.

Contoh:

SMART Inventory:

- Barang
- Gudang
- Pembelian
- Penjualan
- Stok

SMART POS:

- Kasir
- Transaksi
- Shift
- Closing

e-Profit:

- Accounting
- Finance
- Reporting

Application fokus menyelesaikan masalah bisnis.

---

# GOLDEN RULES

## Rule 1

# Platform First

Sebelum membuat fitur baru:

Tanyakan:

> Apakah fitur ini merupakan kemampuan umum yang dibutuhkan banyak aplikasi?

Jika YA:

Implementasikan pada Platform.

---

## Rule 2

# Framework First

Jika fitur bukan kemampuan Platform tetapi dapat digunakan oleh banyak aplikasi:

Implementasikan pada Framework.

---

## Rule 3

# Thin Application

Application harus tetap sederhana.

Application hanya mengandung:

- Business Logic
- Business Rule
- Business Workflow
- Business Validation

---

## Rule 4

# No Duplicate Foundation

Tidak boleh setiap aplikasi membuat ulang:

- Authentication
- Permission
- Session
- Database Layer
- API Layer
- UI Component
- Theme
- Workspace
- Audit

Semua kemampuan tersebut harus berasal dari Platform atau Framework.

---

# APPLICATION AGNOSTIC

SMART Platform harus bersifat Application Agnostic.

Artinya:

Platform tidak boleh bergantung pada satu aplikasi tertentu.

Contoh:

Platform tidak boleh dibuat khusus hanya untuk Inventory.

Karena Platform harus mampu menjalankan:

- Inventory
- POS
- e-Profit
- Smart WMS
- SITAMPAN
- Santri Pintar
- Future Applications

---

# REFERENCE IMPLEMENTATION

SMART Inventory berfungsi sebagai:

> Reference Implementation of SMART Framework.

Artinya:

Inventory digunakan untuk menguji:

- Kemampuan Framework
- Stabilitas Architecture
- Reusability
- Developer Experience

Inventory bukan pusat arsitektur.

---

# DEVELOPMENT PRINCIPLE

Semua pengembangan mengikuti urutan:

```
Vision

↓

Constitution

↓

Architecture

↓

Specification

↓

Framework

↓

Application

↓

Business Feature
```

Tidak diperbolehkan langsung membangun fitur bisnis tanpa memahami fondasi.

---

# CLEAN RESPONSIBILITY

Setiap komponen memiliki tanggung jawab yang jelas.

```
Platform

Mengatur ekosistem


Framework

Menyediakan kemampuan teknis


Application

Menyelesaikan kebutuhan bisnis
```

Tidak boleh terjadi:

- Business logic di Framework.
- Database logic di Application.
- Deployment logic di Application.
- Permission logic di Business Module.

---

# MULTI COMPANY PRINCIPLE

SMART Platform harus mendukung banyak perusahaan.

Setiap Company memiliki:

- Data sendiri.
- User sendiri.
- Configuration sendiri.
- Branding sendiri.
- Permission sendiri.

Application harus selalu berjalan dalam Company Context.

---

# SESSION PRINCIPLE

Session menjadi pusat context aplikasi.

Session minimal mengetahui:

```
User

Company

Application

Workspace

Theme

Locale

Environment
```

Seluruh komponen mengambil context dari Session.

---

# SECURITY PRINCIPLE

Security menjadi bagian utama sejak awal.

Prinsip:

- Secure by Design
- Least Privilege
- Permission Based Access
- Audit Everything
- No Hardcoded Authorization

---

# DEVELOPMENT ENVIRONMENT

SMART Platform mendukung pemisahan:

```
Development

↓

Staging

↓

Production
```

Developer bebas melakukan eksperimen pada Development.

Production harus selalu stabil.

---

# CHANGE MANAGEMENT

Perubahan besar harus mempertimbangkan:

- Dampak terhadap Framework.
- Dampak terhadap Application lain.
- Backward Compatibility.
- Migration Strategy.

Tidak semua perubahan harus langsung diterapkan.

---

# DOCUMENTATION FIRST

Setiap perubahan besar wajib memiliki dokumentasi.

Urutan:

```
Design

↓

Documentation

↓

Implementation

↓

Testing

↓

Release
```

Dokumentasi bukan pekerjaan tambahan.

Dokumentasi adalah bagian dari pembangunan Platform.

---

# CODING PRINCIPLES

Seluruh kode wajib mengikuti:

- Clean Architecture
- SOLID Principle
- Single Responsibility
- Dependency Injection
- Composition Over Inheritance
- Repository Pattern
- Separation of Concern
- Reusable Component

---

# FORBIDDEN PRACTICES

Dilarang:

```
Hardcoded Company ID

Hardcoded Permission

Hardcoded Theme

Hardcoded Workspace

Direct Database Access

Duplicate Foundation

Business Logic in Framework

Business Logic in Platform

Application Specific Code in Core
```

---

# LONG TERM OBJECTIVE

SMART Platform harus menjadi aset teknologi strategis PT SMART VISION INDOTAMA.

Target akhir:

- Mempercepat pembangunan aplikasi.
- Menurunkan biaya pengembangan.
- Meningkatkan kualitas software.
- Mendukung banyak produk digital.
- Menjadi fondasi AI-driven Enterprise Platform.

---

# SUCCESS CRITERIA

SMART Platform berhasil apabila:

✓ Aplikasi baru dapat dibuat lebih cepat.

✓ Developer tidak perlu membangun fondasi berulang.

✓ Semua aplikasi memiliki standar yang sama.

✓ Deployment dan monitoring terpusat.

✓ Platform dapat berkembang tanpa merusak aplikasi lama.

✓ SMART Platform menjadi aset jangka panjang perusahaan.

---

# FINAL STATEMENT

> SMART Platform is the foundation.
>
> SMART Framework is the engine.
>
> Applications are the solutions.
>
> Business value is the destination.

---

**Next Document**

➡ SP-002 - SMART PLATFORM ARCHITECTURE