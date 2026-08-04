# SP-005 - SMART FRAMEWORK SDK

> **Document Code** : SP-005  
> **Document Name** : SMART Framework SDK  
> **Version** : 1.0  
> **Status** : Official  
> **Owner** : PT SMART VISION INDOTAMA  
> **Last Update** : August 2026  

---

# PURPOSE

Dokumen ini mendefinisikan Public SDK SMART Framework.

SMART Framework SDK merupakan kontrak resmi antara Framework dan Application.

Developer Application hanya diperbolehkan menggunakan Public SDK.

Implementasi internal Framework bersifat private dan tidak boleh digunakan secara langsung.

---

# SMART FRAMEWORK POSITION

SMART Framework merupakan engine utama SMART Platform.

Arsitektur:

```
SMART PLATFORM

        |

SMART FRAMEWORK

        |

APPLICATION
```

Framework menyediakan kemampuan teknis.

Application menyediakan kemampuan bisnis.

---

# SDK PRINCIPLE

Prinsip utama:

> Application menggunakan Framework, bukan membangun ulang Framework.

---

# PUBLIC SDK RULE

Developer hanya mengenal:

```
SMART.Session

SMART.Company

SMART.DB

SMART.API

SMART.UI

SMART.Permission

SMART.Platform

SMART.Audit

SMART.Impersonation

SMART.Config
```

---

# PRIVATE IMPLEMENTATION

Developer tidak boleh mengakses:

```
Internal Manager

Internal Service

Internal Repository

Internal Storage

Internal Helper

Internal Context

Internal Validator
```

---

# FRAMEWORK PACKAGE STRUCTURE

Konsep package:

```
packages/

├── smart-core

├── smart-ui

├── smart-data

├── smart-api

├── smart-security

└── smart-config
```

Setiap package memiliki satu Public SDK.

---

# SDK ARCHITECTURE

```
Application

        |

Public SDK

        |

Facade Layer

        |

Internal Implementation

        |

Infrastructure
```

---

# SMART.SESSION

## Purpose

Mengelola context aplikasi.

Session merupakan pusat informasi runtime.

---

## Data Context

```
SMART.Session

{

 user

 company

 application

 workspace

 theme

 locale

 authenticated

}
```

---

## Usage Responsibility

Session digunakan oleh:

- Repository.
- Permission.
- UI.
- API.
- Workflow.

---

## Rule

Application tidak boleh membuat context sendiri.

---

# SMART.COMPANY

## Purpose

Mengelola Company Context.

---

## Responsibility

Menyediakan:

- Current Company.
- Company Information.
- Branding.
- Configuration.

---

## Example Concept

```
SMART.Company.current()
```

menghasilkan:

```
{

 id,

 name,

 type,

 logo,

 theme

}
```

---

# SMART.DB

## Purpose

Database abstraction layer.

---

## Responsibility

Mengelola:

- Connection.
- Repository.
- Query.
- Transaction.
- Audit Field.

---

## Rule

Application tidak boleh:

```
Direct MongoDB Access
```

Semua melalui:

```
SMART.DB
```

---

# DATA FLOW

```
Application

↓

Repository

↓

SMART.DB

↓

Database
```

---

# SMART.API

## Purpose

Standard komunikasi antar sistem.

---

## Responsibility

Mengelola:

- Request.
- Response.
- Authentication.
- Error Handling.
- API Standard.

---

## Rule

Dilarang:

```
fetch()

Direct HTTP Call
```

di Application.

---

# SMART.UI

## Purpose

Menyediakan komponen interface standar.

---

## Component Category

```
Layout

Navigation

Form

Table

Modal

Notification

Feedback

Display
```

---

## Standard Component

Contoh:

```
PageContainer

Sidebar

Topbar

Button

Input

Select

Table

Card

StatCard

Modal
```

---

# UI PRINCIPLE

Application tidak membuat komponen dasar sendiri jika sudah tersedia di SMART.UI.

---

# SMART.PERMISSION

## Purpose

Mengelola authorization.

---

## Permission Model

Menggunakan namespace.

Contoh:

```
inventory.product.read

inventory.product.create

inventory.product.update

inventory.product.delete
```

---

## Flow

```
User

↓

Role

↓

Permission

↓

Access Decision
```

---

# SMART.PLATFORM

## Purpose

Mengakses kemampuan Platform.

---

## Responsibility

Mengelola:

- Application Registry.
- Company Registry.
- Platform Configuration.
- Subscription.
- License.

---

# SMART.AUDIT

## Purpose

Menyediakan audit trail.

---

## Audit Data

```
User

Action

Company

Application

Timestamp

Changes
```

---

# SMART.IMPERSONATION

## Purpose

Mendukung akses bantuan teknis secara aman.

---

## Use Case

Platform Operator membantu:

- Troubleshooting.
- Support.
- Investigasi.

---

## Security Rule

Setiap impersonation:

- Harus memiliki izin.
- Harus tercatat.
- Harus dapat diaudit.

---

# SMART.CONFIG

## Purpose

Mengelola konfigurasi aplikasi.

---

## Configuration Type

```
Environment

Application

Company

Feature Flag

Runtime
```

---

# MULTI COMPANY PRINCIPLE

Semua SDK berjalan dalam Company Context.

Flow:

```
Login

↓

Session

↓

Company Context

↓

Repository

↓

Data Access
```

---

# APPLICATION DEVELOPMENT FLOW

Developer membuat aplikasi dengan pola:

```
Application

↓

SMART SDK

↓

Framework

↓

Infrastructure
```

---

# EXAMPLE APPLICATION STRUCTURE

```
inventory/

├── pages/

├── modules/

├── workflows/

├── reports/

└── services/
```

Application tidak berisi:

```
Authentication

Database Driver

Permission Engine

Theme Engine

Deployment Logic
```

---

# SDK VERSIONING

Framework SDK menggunakan semantic versioning.

Format:

```
Major.Minor.Patch
```

Contoh:

```
1.0.0

1.1.0

2.0.0
```

---

# BACKWARD COMPATIBILITY

Perubahan Framework harus mempertimbangkan aplikasi yang sudah berjalan.

Tidak boleh:

- Menghapus API tanpa migrasi.
- Mengubah behavior tanpa dokumentasi.
- Merusak aplikasi existing.

---

# SDK DEVELOPMENT RULE

Framework developer wajib:

✓ Dokumentasi API.

✓ Testing.

✓ Maintain compatibility.

✓ Review architecture.

✓ Avoid breaking change.

---

# APPLICATION DEVELOPER RULE

Developer aplikasi wajib:

✓ Menggunakan Public SDK.

✓ Mengikuti Architecture.

✓ Tidak mengakses internal Framework.

✓ Tidak membuat ulang foundation.

---

# SUCCESS CRITERIA

SMART Framework SDK berhasil apabila:

✓ Developer dapat membuat aplikasi baru dengan cepat.

✓ Semua aplikasi memiliki pola yang sama.

✓ Foundation tidak terduplikasi.

✓ Perubahan Framework aman terhadap aplikasi.

✓ Framework menjadi aset teknologi perusahaan.

---

# FINAL STATEMENT

```
SMART Framework SDK

is the bridge

between Platform capability

and Application innovation.
```

Framework menyediakan mesin.

Application menghasilkan solusi bisnis.

---

**Next Document**

➡ SP-006 - SMART DEVELOPMENT GUIDE