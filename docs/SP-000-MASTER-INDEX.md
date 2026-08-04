# SP-000 - SMART PLATFORM MASTER INDEX

> **Document Code** : SP-000
>
> **Document Name** : SMART Platform Master Index
>
> **Version** : 1.0
>
> **Status** : Active
>
> **Owner** : PT SMART VISION INDOTAMA
>
> **Last Update** : August 2026

---

# PURPOSE

Dokumen ini merupakan pintu masuk (Master Index) seluruh dokumentasi SMART Platform.

Seluruh developer, AI Assistant, FreeBuff, maupun kontributor wajib memulai dari dokumen ini sebelum membaca dokumen lainnya.

SP-000 mendefinisikan struktur dokumentasi resmi SMART Platform dan hubungan antar dokumen.

---

# SMART PLATFORM DOCUMENTATION

```
SMART PLATFORM DOCUMENTATION

SP-000  Master Index
│
├── SP-001 Constitution
├── SP-002 Architecture
├── SP-003 Roadmap
├── SP-004 Smart Console Specification
├── SP-005 Framework SDK
├── SP-006 Development Guide
│
├── SP-100 Future Documents
│
└── Project EPIC
```

---

# DOCUMENT HIERARCHY

Dokumen SMART Platform memiliki hirarki sebagai berikut.

```
Master Index

↓

Constitution

↓

Architecture

↓

Specification

↓

SDK

↓

Development Guide

↓

EPIC

↓

Source Code
```

Artinya:

Semua Source Code harus mengacu pada EPIC.

EPIC mengacu pada Development Guide.

Development Guide mengacu pada SDK.

SDK mengacu pada Specification.

Specification mengacu pada Architecture.

Architecture mengacu pada Constitution.

Constitution mengacu pada Vision SMART Platform.

---

# DOCUMENT LIST

## SP-000

SMART Platform Master Index

Fungsi:

Pusat seluruh dokumentasi.

---

## SP-001

SMART Platform Constitution

Berisi:

- Vision
- Mission
- Philosophy
- Golden Rules
- Platform Principles
- Layer Responsibility
- Enterprise Standards

Dokumen ini merupakan dokumen tertinggi.

---

## SP-002

SMART Platform Architecture

Berisi:

- System Architecture
- Layer Architecture
- Session Architecture
- Company Architecture
- Deployment Architecture
- Database Architecture
- API Architecture
- Security Architecture
- Runtime Architecture

---

## SP-003

SMART Platform Roadmap

Berisi:

- Roadmap
- Milestone
- Release Plan
- EPIC
- Sprint
- Priority

---

## SP-004

SMART Console Specification

Berisi seluruh spesifikasi SMART Console.

Contoh:

- Dashboard
- Applications
- Companies
- Modules
- Users
- Roles
- Permissions
- Database Explorer
- Storage Explorer
- API Explorer
- Monitoring
- Deployment
- Backup
- Restore
- AI
- Settings

Dokumen ini menjadi acuan pembangunan SMART Console.

---

## SP-005

SMART Framework SDK

Berisi seluruh Public SDK.

Contoh:

```
SMART.Session

SMART.Company

SMART.DB

SMART.API

SMART.UI

SMART.Permission

SMART.Platform

SMART.Storage

SMART.Logger

SMART.Audit

SMART.Impersonation
```

Seluruh programmer hanya menggunakan Public SDK.

---

## SP-006

SMART Development Guide

Panduan resmi pengembangan aplikasi.

Berisi:

- Coding Standard
- Folder Structure
- Module Standard
- Repository Standard
- UI Standard
- API Standard
- Deployment Workflow
- Release Workflow
- Testing Workflow

Dokumen ini wajib dibaca seluruh programmer.

---

# FUTURE DOCUMENTS

Nomor 100 ke atas digunakan untuk dokumen tambahan.

Contoh:

```
SP-100 Deployment Standard

SP-101 Security Standard

SP-102 Coding Standard

SP-103 UI Guideline

SP-104 Database Standard

SP-105 API Standard

SP-106 AI Standard

SP-107 DevOps Guide

SP-108 Monitoring Guide

SP-109 Backup & Recovery
```

---

# PROJECT DOCUMENTS

Setiap Project memiliki folder tersendiri.

Contoh:

```
projects/

inventory/

pos/

eprofit/

santripintar/

sitampan/

desa-insight/
```

Setiap project memiliki:

```
README.md

execution_status.md

EPIC

TASK

CHANGELOG
```

Namun seluruh Project tetap mengacu pada SP Document.

---

# EPIC RELATIONSHIP

```
SP-000

↓

SP-001

↓

SP-002

↓

SP-004

↓

SP-005

↓

SP-006

↓

EPIC

↓

TASK

↓

SOURCE CODE
```

Dengan demikian:

Task tidak boleh bertentangan dengan EPIC.

EPIC tidak boleh bertentangan dengan Development Guide.

Development Guide tidak boleh bertentangan dengan SDK.

SDK tidak boleh bertentangan dengan Smart Console Specification.

Specification tidak boleh bertentangan dengan Architecture.

Architecture tidak boleh bertentangan dengan Constitution.

---

# AI DEVELOPMENT FLOW

Seluruh AI Assistant wajib mengikuti alur berikut.

```
Read SP-000

↓

Read Constitution

↓

Read Architecture

↓

Read Specification

↓

Read SDK

↓

Read Development Guide

↓

Read EPIC

↓

Read Task

↓

Implement Source Code
```

AI tidak diperbolehkan langsung membaca Source Code tanpa memahami dokumentasi.

---

# DEVELOPER WORKFLOW

Seluruh Developer mengikuti alur berikut.

```
Planning

↓

Documentation

↓

Architecture Review

↓

Development

↓

Testing

↓

Commit

↓

Build

↓

Deploy

↓

Production
```

Development dimulai dari dokumentasi, bukan dari coding.

---

# SMART PLATFORM PHILOSOPHY

SMART Platform dibangun dengan filosofi:

> **Platform terlebih dahulu.**

Platform menghasilkan Framework.

Framework menghasilkan Application.

Application menghasilkan Business Value.

Developer tidak membangun aplikasi dari nol.

Developer membangun aplikasi di atas Platform.

---

# DOCUMENT VERSIONING

Setiap dokumen memiliki format:

```
Major.Minor.Patch
```

Contoh:

```
1.0.0

1.1.0

1.2.0

2.0.0
```

Perubahan besar wajib dicatat pada CHANGELOG.

---

# REPOSITORY STRUCTURE

Direkomendasikan struktur dokumentasi sebagai berikut.

```
docs/

SP-000-MASTER-INDEX.md

SP-001-CONSTITUTION.md

SP-002-ARCHITECTURE.md

SP-003-ROADMAP.md

SP-004-SMART-CONSOLE.md

SP-005-FRAMEWORK-SDK.md

SP-006-DEVELOPMENT-GUIDE.md

projects/

inventory/

pos/

eprofit/

sitampan/

santripintar/

desa-insight/
```

---

# GOLDEN RULE

Seluruh pengembangan SMART Platform wajib mengikuti urutan berikut.

```
Vision

↓

Constitution

↓

Architecture

↓

Specification

↓

SDK

↓

Development Guide

↓

EPIC

↓

Task

↓

Source Code
```

Tidak diperbolehkan membangun Source Code tanpa acuan dokumentasi.

---

# SUCCESS CRITERIA

SMART Platform memiliki dokumentasi yang:

- Terstruktur
- Konsisten
- Mudah dipelajari
- Mudah dipelihara
- Dapat digunakan oleh Developer maupun AI Assistant
- Menjadi acuan resmi seluruh pengembangan

---

# OFFICIAL STATEMENT

Seluruh dokumen SMART Platform merupakan referensi resmi dalam pengembangan seluruh aplikasi PT SMART VISION INDOTAMA.

Apabila terjadi perbedaan antara implementasi dan dokumentasi, maka dokumentasi menjadi acuan utama sampai dilakukan revisi resmi.

---

**Next Document**

➡ **SP-001 - SMART PLATFORM CONSTITUTION**