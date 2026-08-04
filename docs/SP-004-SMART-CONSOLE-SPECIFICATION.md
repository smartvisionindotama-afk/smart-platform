# SP-004 - SMART PLATFORM CONSOLE SPECIFICATION

> **Document Code** : SP-004  
> **Document Name** : SMART Platform Console Specification  
> **Version** : 1.1  
> **Status** : Official Revised  
> **Owner** : PT SMART VISION INDOTAMA  
> **Related EPIC** : EPIC-003 SMART Console  
> **Last Update** : August 2026  

---

# PURPOSE

Dokumen ini mendefinisikan spesifikasi SMART Console sebagai pusat kendali utama SMART Platform.

SMART Console merupakan Control Plane yang digunakan untuk mengelola, memonitor, dan mengoperasikan seluruh ekosistem SMART Platform.

SMART Console bukan aplikasi bisnis.

SMART Console tidak digunakan untuk transaksi perusahaan.

SMART Console digunakan untuk pengelolaan platform.

---

# SMART CONSOLE VISION

SMART Console dibangun dengan konsep:

> Firebase Console untuk Enterprise Application Ecosystem.

Jika Firebase Console menyediakan kemampuan:

- Project Management
- Database Explorer
- Authentication Management
- Monitoring

maka SMART Console menyediakan kemampuan yang lebih luas:

```
Platform Management

+

Application Management

+

Company Registry

+

Database Observation

+

Deployment Management

+

Monitoring

+

AI Management
```

---

# POSITION IN ARCHITECTURE

SMART Console berada pada layer Platform.

```
                 SMART PLATFORM


                       │


              SMART CONSOLE


                       │


             SMART PLATFORM API


                       │


             SMART FRAMEWORK


                       │


              APPLICATION
```

---

# CONTROL PLANE AND BUSINESS PLANE

SMART Platform menerapkan pemisahan antara Control Plane dan Business Plane.

---

# CONTROL PLANE

Control Plane adalah area pengelolaan platform.

Komponen:

```
SMART Console

↓

Platform API

↓

Framework Services

↓

Infrastructure
```

Control Plane bertanggung jawab terhadap:

- Application Management.
- Company Registry.
- Deployment.
- Monitoring.
- Security.
- Configuration.
- Infrastructure Operation.

---

# BUSINESS PLANE

Business Plane adalah area operasional bisnis.

Komponen:

```
Application

↓

Company

↓

User

↓

Transaction
```

Contoh Business Plane:

- e-Profit.
- SMART Inventory.
- SMART POS.
- SITAMPAN.
- Santri Pintar.
- Desa Insight.

---

# SECURITY PRINCIPLE

Pemisahan Control Plane dan Business Plane bertujuan untuk:

- Mengurangi attack surface.
- Melindungi infrastruktur.
- Menjaga isolasi antar company.
- Mencegah akses langsung ke server.
- Mencegah perubahan konfigurasi platform oleh user bisnis.
- Mempermudah audit keamanan.

---

# USER ACCESS MODEL

SMART Console bukan bagian dari aplikasi bisnis.

SMART Console hanya dapat diakses oleh internal pengelola platform.

User eksternal dan Company User tidak memiliki akses langsung ke SMART Console.

---

# SMART CONSOLE USER TYPE

SMART Console memiliki dua jenis pengguna.

```
SUPER ADMIN

PLATFORM OPERATOR
```

---

# SUPER ADMIN

Super Admin merupakan pemegang akses tertinggi pada SMART Platform.

Tanggung jawab:

- Mengelola seluruh aplikasi.
- Mengelola seluruh company.
- Mengatur subscription.
- Mengatur license.
- Mengelola konfigurasi global.
- Mengawasi keamanan platform.
- Mengambil keputusan strategis platform.

Super Admin tidak melakukan transaksi bisnis.

---

# PLATFORM OPERATOR

Platform Operator merupakan tim internal yang menjalankan operasional SMART Platform.

Tanggung jawab:

- Monitoring sistem.
- Deployment.
- Maintenance.
- Troubleshooting.
- Support teknis.
- Pemeriksaan log.
- Pemeriksaan kesehatan server.

Platform Operator tidak memiliki kewenangan bisnis pada Application.

---

# COMPANY USER ACCESS

Company User tidak memiliki akses ke SMART Console.

Company User mengakses sistem melalui Application masing-masing.

Contoh:

```
e-Profit

↓

e-profit.id


SMART Inventory

↓

inv.e-profit.id


SMART POS

↓

pos.e-profit.id
```

---

# COMPANY ADMIN MODEL

Company Admin tidak memiliki akses ke SMART Console.

Company Admin hanya memiliki kewenangan dalam Application.

Contoh:

Company Admin e-Profit dapat:

- Mengelola user perusahaan.
- Mengatur role aplikasi.
- Melihat laporan.
- Mengelola transaksi.
- Mengatur workflow bisnis.

Namun Company Admin tidak dapat:

- Mengakses server.
- Melihat database platform.
- Melakukan deployment.
- Melihat system log.
- Mengubah konfigurasi platform.
- Mengakses company lain.

---

# CONSOLE STRUCTURE

```
SMART CONSOLE

├── Dashboard

├── Applications

├── Companies

├── Users

├── Permissions

├── Database

├── API

├── Deployment

├── Monitoring

├── Logs

├── Backup

├── AI

└── Settings
```

---

# MODULE 1

# DASHBOARD

## Purpose

Menampilkan kondisi keseluruhan SMART Platform.

---

## Widget

Dashboard menampilkan:

```
Applications

Companies

Active Users

Server Status

Database Status

System Health

Recent Activity
```

---

# MODULE 2

# APPLICATION MANAGEMENT

## Purpose

Mengelola seluruh aplikasi dalam ekosistem SMART Platform.

---

## Application Registry

Data:

```
Application ID

Name

Code

URL

Version

Status

Environment

Owner
```

---

## Capability

Admin dapat:

- Register Application.
- Activate Application.
- Disable Application.
- Update Version.
- Melihat Health Status.

---

# MODULE 3

# COMPANY MANAGEMENT

## Purpose

Mengelola registry seluruh company.

---

## Company Data

```
Company ID

Name

Code

Type

Logo

Theme

Workspace

Status
```

---

## Company Type

```
PT

CV

BUMDes

Koperasi

Pesantren

Pemerintah

Other
```

---

# MODULE 4

# USER MANAGEMENT

## Purpose

Mengelola user platform.

---

## User Data

```
User ID

Name

Email

Company

Role

Status

Last Login
```

---

# MODULE 5

# PERMISSION MANAGEMENT

## Purpose

Mengelola authorization system.

---

## Permission Model

Menggunakan namespace.

Contoh:

```
inventory.product.read

inventory.product.create

inventory.product.update

inventory.product.delete

settings.user.manage
```

---

## Structure

```
User

↓

Role

↓

Permission

↓

Access
```

---

# MODULE 6

# DATABASE EXPLORER

## Purpose

Database Explorer merupakan fitur utama SMART Console.

Konsep:

> Firebase Firestore Console versi Enterprise.

---

## Capability

Melihat:

```
Database

↓

Collection

↓

Document

↓

Field
```

---

## Features

- Browse Data.
- Search.
- Filter.
- Query.
- View Structure.
- Index Information.
- Statistics.

---

## Security Rule

Database Explorer tidak boleh menjadi jalur bypass keamanan.

Semua aktivitas:

- Menggunakan permission.
- Dicatat dalam audit.
- Memiliki batas akses.

---

# MODULE 7

# API EXPLORER

## Purpose

Menyediakan fasilitas pengujian dan observasi API.

---

## Features

```
Endpoint List

Request Builder

Response Viewer

Authentication

API Log
```

---

# MODULE 8

# DEPLOYMENT CENTER

## Purpose

Mengelola proses deployment aplikasi.

---

## Workflow

```
Source Code

↓

Build

↓

Test

↓

Release

↓

Deploy

↓

Health Check
```

---

## Features

- Deploy.
- Restart.
- Rollback.
- Version History.
- Environment Management.

---

# MODULE 9

# MONITORING CENTER

## Purpose

Melihat kesehatan sistem.

---

## Monitoring Data

```
CPU

Memory

Storage

Network

Database

Runtime

Error
```

---

# MODULE 10

# LOG CENTER

## Purpose

Pusat troubleshooting dan audit.

---

## Log Type

```
System Log

Application Log

API Log

Security Log

Audit Log
```

---

# MODULE 11

# BACKUP CENTER

## Purpose

Mengelola keamanan data.

---

## Features

```
Backup Schedule

Manual Backup

Restore

Backup History
```

---

# MODULE 12

# AI CENTER

## Purpose

Mengelola kemampuan AI pada SMART Platform.

---

## Future Capability

```
AI Model

AI Agent

AI Assistant

AI Usage

AI Cost
```

---

# DEVELOPMENT PRINCIPLE

SMART Console wajib menggunakan:

```
SMART Framework

SMART UI

SMART API

SMART Session

SMART Permission
```

SMART Console tidak boleh membuat foundation sendiri.

---

# MVP IMPLEMENTATION PRIORITY

## Phase 1 - Platform Foundation

Target:

- Login.
- Dashboard.
- Application Registry.
- Company Registry.

---

## Phase 2 - Administration

Target:

- User.
- Role.
- Permission.

---

## Phase 3 - Developer Tools

Target:

- Database Explorer.
- API Explorer.

---

## Phase 4 - Operation

Target:

- Monitoring.
- Deployment.
- Logs.
- Backup.

---

## Phase 5 - Intelligence

Target:

- AI Center.
- Automation.
- Smart Assistant.

---

# SUCCESS CRITERIA

SMART Console berhasil apabila:

✓ Seluruh aplikasi dapat terdaftar.

✓ Platform dapat dikelola terpusat.

✓ Monitoring tidak membutuhkan akses SSH langsung.

✓ Database dapat diamati melalui Console.

✓ Deployment dapat dilakukan melalui platform.

✓ Security boundary antara platform dan bisnis tetap terjaga.

---

# DOCUMENT REVISION HISTORY

## Version 1.1

### Change

Control Plane Security Model.

---

### Decision

Company Admin dihapus dari akses SMART Console.

---

### Reason

- Security enhancement.
- Tenant isolation.
- Infrastructure protection.
- Reduced attack surface.

---

# FINAL STATEMENT

```
SMART Console

is the Control Center

of SMART Platform.
```

SMART Console menjadikan SMART Platform bukan hanya kumpulan aplikasi, tetapi sebuah ekosistem digital yang dapat dikelola, diamati, dan dikembangkan secara aman serta berkelanjutan.

---

**Next Document**

➡ SP-005 - SMART FRAMEWORK SDK