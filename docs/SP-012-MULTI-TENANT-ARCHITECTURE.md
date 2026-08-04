# SP-012 - SMART MULTI TENANT ARCHITECTURE

> **Document Code** : SP-012  
> **Document Name** : SMART Multi Tenant Architecture  
> **Version** : 1.0  
> **Status** : Official  
> **Owner** : PT SMART VISION INDOTAMA  
> **Last Update** : August 2026  

---

# PURPOSE

Dokumen ini mendefinisikan arsitektur Multi Tenant pada SMART Platform.

Dokumen ini menjadi standar untuk:

- Pengelolaan banyak Company.
- Data Isolation.
- Company Context.
- Subscription Model.
- Application Access.
- SaaS Architecture.

---

# MULTI TENANT VISION

SMART Platform dibangun sebagai:

> Enterprise Multi Tenant Application Platform.

Artinya:

Satu platform dapat melayani banyak organisasi dengan tetap menjaga:

- Keamanan.
- Pemisahan data.
- Fleksibilitas konfigurasi.
- Skalabilitas.

---

# MULTI TENANT CONCEPT

Arsitektur:

```
SMART PLATFORM

        |

Tenant Management

        |

Company A
Company B
Company C
Company D

        |

Application
```

---

# TENANT DEFINITION

Tenant adalah satu entitas organisasi yang menggunakan SMART Platform.

Contoh:

```
PT ABC

BUMDes Maju

Koperasi Sejahtera

Pesantren XYZ
```

---

# TENANT MODEL

Setiap Tenant memiliki:

```
Company ID

Company Profile

Application Access

User

Role

Permission

Configuration

Data
```

---

# TENANT ISOLATION PRINCIPLE

Prinsip utama:

```
Tenant A

tidak dapat mengakses

Tenant B
```

---

# DATA ISOLATION MODEL

SMART Platform menggunakan:

```
Logical Data Isolation
```

dengan:

```
companyId
```

sebagai tenant identifier.

---

# DATA FLOW

```
User Login

↓

Company Context

↓

Repository

↓

Automatic Filter

↓

Tenant Data
```

---

# COMPANY CONTEXT

Company Context berasal dari:

```
SMART.Session

        |

SMART.Company

        |

Repository
```

---

# COMPANY CONTEXT RULE

Application tidak boleh:

```
Mengirim companyId sendiri

Mengubah companyId

Melewati company filter
```

---

# TENANT REGISTRY

SMART Console menyimpan:

```
Tenant Registry
```

---

# TENANT DATA

```
Company ID

Name

Type

Status

Subscription

Applications

Created Date
```

---

# COMPANY TYPE

SMART Platform mendukung:

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

# APPLICATION TENANCY

Setiap Application memiliki tenant scope.

Contoh:

```
e-Profit

↓

Company A

Company B

Company C
```

---

# APPLICATION ACCESS MODEL

Company dapat mengaktifkan aplikasi tertentu.

Contoh:

```
Company A

✓ e-Profit

✓ POS

✓ Inventory


Company B

✓ Inventory
```

---

# APPLICATION REGISTRY

Hubungan:

```
Application

        |

Tenant

        |

Subscription
```

---

# USER TENANCY

User dapat memiliki:

```
Single Company Access

Multiple Company Access
```

---

# EXAMPLE

Holding Manager:

```
Company A

Company B

Company C
```

---

# COMPANY SWITCHING

Jika user memiliki banyak tenant:

Flow:

```
Login

↓

Select Company

↓

Create Context

↓

Open Application
```

---

# SUBSCRIPTION MODEL

Multi Tenant mendukung SaaS Model.

---

# SUBSCRIPTION DATA

```
Company

Application

Package

Status

Start Date

End Date
```

---

# FEATURE ACCESS

Feature dapat dikontrol berdasarkan:

```
Subscription

License

Permission
```

---

# EXAMPLE

Package Basic:

```
Accounting

Reporting
```

Package Enterprise:

```
Accounting

Inventory

POS

AI Assistant
```

---

# TENANT CONFIGURATION

Setiap tenant dapat memiliki:

```
Theme

Workspace

Feature Setting

Workflow Setting

Business Rule
```

---

# BRANDING ISOLATION

Tenant dapat memiliki:

```
Logo

Color Theme

Name

Identity
```

---

# SECURITY BOUNDARY

Tenant tidak boleh mengetahui:

```
Tenant lain

Platform Configuration

Infrastructure Detail
```

---

# SUPER ADMIN ACCESS

Super Admin dapat melihat:

```
All Tenant Registry
```

melalui:

```
SMART Console
```

---

# SUPER ADMIN LIMITATION

Super Admin tidak mengelola transaksi bisnis tenant.

---

# TRANSACTION OWNERSHIP

Setiap transaksi tetap milik:

```
Tenant

↓

Application

↓

Business User
```

---

# MULTI TENANT DATABASE STRATEGY

SMART Platform menggunakan pendekatan:

```
Shared Database

+

Logical Tenant Isolation
```

---

# FUTURE SCALABILITY

Jika diperlukan dapat berkembang menjadi:

```
Shared Database

↓

Dedicated Database Tenant

↓

Dedicated Infrastructure
```

---

# TENANT MIGRATION

SMART Platform harus mendukung:

```
Export Tenant Data

Backup Tenant

Migration Tenant

Restore Tenant
```

---

# AUDIT TENANT

Setiap aktivitas harus mencatat:

```
Tenant

User

Application

Action

Timestamp
```

---

# DEVELOPMENT RULE

Developer wajib:

✓ Menggunakan Company Context.

✓ Menggunakan Repository.

✓ Menjaga Tenant Isolation.

✓ Tidak membuat tenant logic sendiri.

✓ Menggunakan SMART Framework.

---

# DILARANG

```
Hardcoded Company ID

Cross Tenant Query

Manual Tenant Switching

Shared User Credential

Expose Tenant Data
```

---

# MULTI TENANT TESTING

Wajib diuji:

```
Tenant Isolation Test

Permission Test

Data Access Test

Company Switching Test
```

---

# SUCCESS CRITERIA

SMART Multi Tenant Architecture berhasil apabila:

✓ Ribuan company dapat berada dalam satu platform.

✓ Data antar company terisolasi.

✓ User dapat berpindah sesuai hak akses.

✓ Subscription dapat dikontrol.

✓ Platform dapat berkembang sebagai SaaS.

---

# FINAL STATEMENT

```
One Platform

Many Organizations

Securely Connected.
```

SMART Multi Tenant Architecture menjadikan SMART Platform siap berkembang sebagai enterprise SaaS ecosystem.

---

**Next Document**

➡ SP-013 - SMART APPLICATION ARCHITECTURE