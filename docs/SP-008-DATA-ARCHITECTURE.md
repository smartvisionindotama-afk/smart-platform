# SP-008 - SMART DATA ARCHITECTURE

> **Document Code** : SP-008  
> **Document Name** : SMART Data Architecture  
> **Version** : 1.0  
> **Status** : Official  
> **Owner** : PT SMART VISION INDOTAMA  
> **Last Update** : August 2026  

---

# PURPOSE

Dokumen ini mendefinisikan arsitektur data SMART Platform.

Dokumen ini menjadi standar untuk:

- Database Design.
- Data Access.
- Multi Company Data Isolation.
- Repository Architecture.
- Audit Data.
- Database Explorer.
- Data Governance.

---

# DATA VISION

SMART Platform memandang data sebagai aset strategis perusahaan.

Prinsip:

> Data bukan hanya tempat menyimpan transaksi, tetapi fondasi pengambilan keputusan dan kecerdasan bisnis.

---

# DATA ARCHITECTURE PRINCIPLE

SMART Data Architecture menggunakan prinsip:

```
Secure

Consistent

Scalable

Auditable

Reusable

Observable
```

---

# DATA ARCHITECTURE POSITION

Arsitektur data:

```
Application

        |

Repository Layer

        |

SMART.DB

        |

Database Layer

        |

Storage
```

---

# DATABASE TECHNOLOGY

SMART Platform menggunakan:

```
MongoDB
```

sebagai database utama.

---

# DATABASE ACCESS RULE

Application tidak boleh mengakses MongoDB secara langsung.

Dilarang:

```
Direct MongoDB Driver

Direct Connection

Raw Query dari Application
```

---

# STANDARD DATA FLOW

Flow resmi:

```
Application

↓

Repository

↓

SMART.DB

↓

MongoDB

↓

Storage
```

---

# SMART.DB RESPONSIBILITY

SMART.DB bertanggung jawab terhadap:

- Database connection.
- Query abstraction.
- Transaction handling.
- Error handling.
- Audit integration.
- Data validation.
- Security enforcement.

---

# REPOSITORY PATTERN

Semua data access menggunakan Repository Pattern.

---

# PURPOSE

Repository menjadi penghubung antara:

```
Business Logic

↓

Data Storage
```

---

# REPOSITORY RESPONSIBILITY

Repository mengelola:

- Query.
- Filter.
- Create.
- Update.
- Delete.
- Data transformation.

---

# APPLICATION DATA RULE

Application hanya mengetahui:

```
Repository Interface
```

Application tidak mengetahui:

```
Database Driver

Collection Detail

Connection Detail
```

---

# MULTI COMPANY DATA ARCHITECTURE

SMART Platform adalah Multi Tenant Platform.

Setiap data harus memiliki Company Context.

---

# TENANT ISOLATION PRINCIPLE

Data:

```
Company A

tidak boleh melihat

Company B
```

---

# COMPANY CONTEXT FLOW

```
User Login

↓

SMART.Session

↓

Company Context

↓

Repository

↓

Database Query
```

---

# AUTOMATIC COMPANY FILTER

Repository otomatis menambahkan:

```
companyId
```

pada query.

---

# EXAMPLE

Application:

```
ProductRepository.findAll()
```

Framework:

```
SELECT *

WHERE

companyId = currentCompany.id
```

---

# APPLICATION RULE

Application developer tidak perlu mengirim:

```
companyId
```

secara manual.

---

# STANDARD DOCUMENT FIELD

Setiap collection bisnis wajib memiliki:

```
_id

companyId

createdBy

updatedBy

createdAt

updatedAt

status
```

---

# FIELD DESCRIPTION

## _id

Primary identifier document.

---

## companyId

Identitas pemilik data.

Digunakan untuk:

- Isolation.
- Filtering.
- Authorization.

---

## createdBy

User pembuat data.

---

## updatedBy

User terakhir yang mengubah data.

---

## createdAt

Waktu pembuatan data.

---

## updatedAt

Waktu perubahan terakhir.

---

## status

Status lifecycle data.

Contoh:

```
active

inactive

deleted
```

---

# SOFT DELETE PRINCIPLE

Data tidak langsung dihapus permanen.

Default:

```
Soft Delete
```

---

# DELETE FLOW

```
Delete Request

↓

Update Status

↓

Audit Created

↓

Data Hidden
```

---

# AUDIT DATA ARCHITECTURE

Setiap perubahan penting harus dapat dilacak.

---

# AUDIT COLLECTION

Contoh:

```
audit_logs
```

---

# AUDIT STRUCTURE

```
{
 userId,

 companyId,

 action,

 collection,

 documentId,

 oldValue,

 newValue,

 timestamp
}
```

---

# DATABASE NAMING STANDARD

Collection menggunakan:

```
snake_case
```

Contoh:

```
users

companies

products

stock_movements

sales_transactions
```

---

# COLLECTION DESIGN RULE

Collection harus:

- Memiliki tujuan jelas.
- Tidak mencampur domain.
- Mudah di-query.
- Memiliki index yang tepat.

---

# DOMAIN DATA SEPARATION

Contoh:

Inventory:

```
products

categories

warehouses

stock_movements
```

Accounting:

```
accounts

journal_entries

financial_reports
```

---

# INDEX STRATEGY

Index dibuat berdasarkan:

- Query utama.
- Performance.
- Business requirement.

---

# DATA VALIDATION

Validasi dilakukan pada:

```
Application Layer

+

Repository Layer

+

Database Layer
```

---

# DATA MIGRATION

Setiap perubahan struktur data harus memiliki:

```
Migration Plan

Backup

Testing

Rollback Strategy
```

---

# DATABASE EXPLORER ARCHITECTURE

SMART Console menyediakan:

```
Database Explorer

↓

Database

↓

Collection

↓

Document

↓

Field
```

---

# DATABASE EXPLORER FUNCTION

Fitur:

- Browse data.
- Search.
- Filter.
- Query.
- View structure.
- View index.
- View statistics.

---

# DATABASE EXPLORER SECURITY

Database Explorer bukan bypass database.

Akses harus:

```
Permission

↓

Audit

↓

Action
```

---

# DATA BACKUP ARCHITECTURE

Backup wajib mendukung:

```
Full Backup

Incremental Backup

Restore Testing
```

---

# DATA RETENTION

Data retention mengikuti:

- Business requirement.
- Regulation.
- Storage capability.

---

# DATA GOVERNANCE

SMART Platform menerapkan:

```
Data Ownership

Data Quality

Data Security

Data Availability
```

---

# AI DATA READINESS

SMART Platform disiapkan untuk AI.

Data harus:

- Terstruktur.
- Konsisten.
- Terlacak.
- Berkualitas.

---

# AI DATA FLOW

Future:

```
Application Data

↓

SMART Data Layer

↓

AI Engine

↓

Business Intelligence
```

---

# DEVELOPMENT RULE

Developer wajib:

✓ Menggunakan Repository.

✓ Mengikuti Standard Field.

✓ Menambahkan Audit.

✓ Memahami Multi Company.

✓ Membuat Index yang tepat.

---

# DILARANG

```
Direct Database Access

Hardcoded Company Filter

Missing Audit Field

Uncontrolled Data Migration

Public Database Exposure
```

---

# DATA SUCCESS CRITERIA

SMART Data Architecture berhasil apabila:

✓ Data setiap company terisolasi.

✓ Semua akses tercatat.

✓ Database mudah diamati.

✓ Aplikasi tidak tergantung database langsung.

✓ Data siap digunakan untuk AI.

---

# FINAL STATEMENT

```
Good Data Architecture

creates

Reliable Applications

and Intelligent Platforms.
```

SMART Data Architecture menjadikan data sebagai aset strategis yang aman, terstruktur, dan siap berkembang.

---

**Next Document**

➡ SP-009 - SMART API ARCHITECTURE