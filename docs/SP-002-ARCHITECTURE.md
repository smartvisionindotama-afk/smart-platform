# SP-002 - SMART PLATFORM ARCHITECTURE

> **Document Code** : SP-002  
> **Document Name** : SMART Platform Architecture  
> **Version** : 1.0  
> **Status** : Official  
> **Owner** : PT SMART VISION INDOTAMA  
> **Last Update** : August 2026  

---

# PURPOSE

Dokumen ini menjelaskan arsitektur teknis SMART Platform.

Dokumen ini menjadi referensi dalam:

- Pengembangan Framework.
- Pengembangan Application.
- Pengembangan SMART Console.
- Deployment.
- Maintenance.
- Scaling.

---

# ARCHITECTURE OVERVIEW

SMART Platform menggunakan pendekatan:

- Modular Architecture
- Layered Architecture
- Clean Architecture
- Multi Application Architecture
- Multi Company Architecture

Arsitektur utama:

```
                    SMART PLATFORM

                          │

        ┌─────────────────┴─────────────────┐

        │                                   │

 SMART PLATFORM SERVICES             SMART CONSOLE


                          │

                   SMART FRAMEWORK


                          │

        ┌─────────────────┼─────────────────┐

        │                 │                 │

 SMART Inventory      SMART POS        e-Profit

 Application          Application      Application
```

---

# ARCHITECTURE PRINCIPLE

## Separation of Responsibility

Setiap layer memiliki tanggung jawab sendiri.

```
Platform

Mengelola ekosistem


Framework

Menyediakan kemampuan teknis


Application

Menjalankan proses bisnis
```

Tidak boleh terjadi pertukaran tanggung jawab.

---

# SYSTEM COMPONENT

SMART Platform terdiri dari beberapa komponen utama:

```
SMART Platform

├── Platform Core

├── SMART Console

├── SMART Framework

├── Applications

├── Data Layer

├── API Layer

├── Security Layer

└── Infrastructure Layer
```

---

# PLATFORM CORE

Platform Core adalah pusat layanan global.

Tanggung jawab:

- Application Registry
- Company Registry
- User Management
- Permission Management
- Configuration Management
- Environment Management
- Platform Settings

Platform Core digunakan oleh seluruh aplikasi.

---

# SMART CONSOLE ARCHITECTURE

SMART Console merupakan interface administrasi Platform.

Fungsi:

- Mengelola aplikasi.
- Mengelola perusahaan.
- Monitoring.
- Deployment.
- Database Explorer.
- API Explorer.
- Log Viewer.

Arsitektur:

```
Browser

↓

SMART Console UI

↓

SMART Platform API

↓

Platform Services

↓

Database
```

---

# FRAMEWORK ARCHITECTURE

SMART Framework adalah runtime layer.

Struktur konseptual:

```
SMART Framework

├── Core

├── UI

├── Data

├── API

├── Security

├── Config

└── Services
```

---

# FRAMEWORK RESPONSIBILITY

## Core

Mengelola:

- Application Context
- Session
- Lifecycle
- Common Services


## UI

Mengelola:

- Component
- Layout
- Theme
- Styling


## Data

Mengelola:

- Database Access
- Repository
- Data Provider


## API

Mengelola:

- Communication
- Request
- Response


## Security

Mengelola:

- Authentication
- Authorization
- Permission


## Config

Mengelola:

- Environment
- Application Configuration

---

# APPLICATION ARCHITECTURE

Setiap aplikasi mengikuti pola:

```
Application

├── Pages

├── Modules

├── Business Logic

├── Workflow

└── Reports
```

Application menggunakan Framework.

Application tidak membuat ulang service dasar.

---

# APPLICATION FLOW

Contoh alur request:

```
User

↓

Application UI

↓

SMART Framework

↓

SMART API

↓

Platform Service

↓

Repository

↓

Database
```

---

# SESSION ARCHITECTURE

Session adalah pusat context.

```
SMART.Session

{

 user

 company

 application

 workspace

 theme

 locale

 environment

 authenticated

}
```

Semua service membaca context dari Session.

---

# AUTHENTICATION FLOW

Arsitektur login:

```
User

↓

Login Page

↓

Authentication Service

↓

Validate Credential

↓

Create Session

↓

Load Company Context

↓

Load Permission

↓

Application Access
```

---

# MULTI COMPANY ARCHITECTURE

SMART Platform mendukung banyak Company.

Konsep:

```
Platform

    |

Company A

    |

Application

    |

Data
```

Setiap transaksi memiliki Company Context.

---

# COMPANY CONTEXT FLOW

```
User Login

↓

Session

↓

Company Selected

↓

Application Loaded

↓

Repository

↓

Automatic Company Filter
```

Application tidak mengirim Company ID secara manual.

---

# PERMISSION ARCHITECTURE

Permission menggunakan Namespace.

Contoh:

```
inventory.product.read

inventory.product.create

inventory.product.update

inventory.product.delete
```

Flow:

```
User

↓

Role

↓

Permission

↓

Application Access
```

---

# DATA ARCHITECTURE

SMART Platform menggunakan database layer.

Konsep:

```
Application

↓

Repository

↓

SMART.DB

↓

Database
```

Application tidak mengakses database secara langsung.

---

# DATABASE PRINCIPLE

Database layer bertanggung jawab terhadap:

- Connection
- Query
- Transaction
- Validation
- Audit Field
- Migration

---

# API ARCHITECTURE

Komunikasi menggunakan:

```
Application

↓

SMART.API

↓

Backend Service

↓

Database
```

Tidak menggunakan akses langsung.

---

# AUDIT ARCHITECTURE

Setiap aktivitas penting harus dapat dilacak.

Audit mencatat:

```
User

Action

Application

Company

Timestamp

Changes
```

---

# DEPLOYMENT ARCHITECTURE

SMART Platform mendukung:

```
Development

↓

Staging

↓

Production
```

Flow:

```
Source Code

↓

Build

↓

Release

↓

Deploy

↓

Health Check

↓

Production
```

---

# INFRASTRUCTURE ARCHITECTURE

Komponen:

```
Server

↓

Docker

↓

Application Runtime

↓

Database

↓

Monitoring
```

Monitoring menjadi bagian Platform.

---

# SMART CONSOLE DATA VIEW

SMART Console menyediakan:

```
Database Explorer

↓

Collection

↓

Document

↓

Query

↓

Index

↓

Statistics
```

Konsep ini terinspirasi dari Firebase Console.

---

# FUTURE SCALABILITY

Arsitektur harus siap mendukung:

- Multiple Server
- Multiple Database
- Cloud Deployment
- AI Service
- Queue System
- Event Driven Architecture
- Marketplace
- Plugin System

---

# ARCHITECTURE RULES

WAJIB:

✓ Separation of Concern

✓ Single Responsibility

✓ Modular Design

✓ Reusable Component

✓ API Based Communication

✓ Session Driven

✓ Repository Pattern

✓ Permission Based Security

---

# DILARANG

✗ Application langsung ke Database

✗ Duplicate Authentication

✗ Duplicate Permission

✗ Hardcoded Context

✗ Business Logic di Framework

✗ Application Specific Logic di Core

---

# ARCHITECTURE SUCCESS CRITERIA

SMART Platform Architecture berhasil apabila:

✓ Framework dapat digunakan banyak aplikasi.

✓ Application dapat berkembang tanpa mengubah Core.

✓ Console dapat mengelola seluruh aplikasi.

✓ Developer memiliki pola kerja yang konsisten.

✓ Sistem siap berkembang jangka panjang.

---

# FINAL ARCHITECTURE STATEMENT

```
SMART Platform

mengendalikan ekosistem.

SMART Framework

menyediakan kemampuan.

Application

menyelesaikan kebutuhan bisnis.
```

---

**Next Document**

➡ SP-003 - SMART PLATFORM ROADMAP
