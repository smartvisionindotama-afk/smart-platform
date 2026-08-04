# SP-006 - SMART DEVELOPMENT GUIDE

> **Document Code** : SP-006  
> **Document Name** : SMART Development Guide  
> **Version** : 1.0  
> **Status** : Official  
> **Owner** : PT SMART VISION INDOTAMA  
> **Last Update** : August 2026  

---

# PURPOSE

Dokumen ini menjadi panduan standar pengembangan aplikasi pada SMART Platform.

Dokumen ini menjelaskan:

- Cara kerja developer.
- Struktur pengembangan.
- Workflow coding.
- Standar kualitas.
- Penggunaan Framework.
- Proses testing.
- Deployment.

---

# DEVELOPMENT PHILOSOPHY

SMART Platform menggunakan prinsip:

> Build correctly before building quickly.

Kecepatan bukan tujuan utama.

Tujuan utama:

- Stabilitas.
- Reusability.
- Maintainability.
- Scalability.

---

# DEVELOPMENT HIERARCHY

Urutan pembangunan:

```
Vision

↓

Architecture

↓

Specification

↓

Framework

↓

Application

↓

Feature

↓

Optimization
```

Developer tidak langsung membuat fitur tanpa memahami posisi fitur tersebut.

---

# DEVELOPMENT RULE

Sebelum coding selalu tanyakan:

```
Apakah fitur ini:

1. Platform Feature?

2. Framework Feature?

3. Application Feature?
```

---

# DECISION RULE

## Jika digunakan banyak aplikasi

Masuk:

```
SMART Platform

atau

SMART Framework
```

---

## Jika hanya kebutuhan satu aplikasi

Masuk:

```
Application Module
```

---

# DEVELOPMENT ENVIRONMENT

SMART Platform menggunakan tiga environment:

```
Development

↓

Staging

↓

Production
```

---

# DEVELOPMENT ENVIRONMENT

Digunakan untuk:

- Coding.
- Eksperimen.
- Testing awal.
- Debugging.

Developer bebas melakukan perubahan.

---

# STAGING ENVIRONMENT

Digunakan untuk:

- Validation.
- Integration Testing.
- User Acceptance Test.

---

# PRODUCTION ENVIRONMENT

Digunakan untuk:

- Sistem aktif.
- Data real.
- Operasional bisnis.

Production harus selalu stabil.

---

# LOCAL DEVELOPMENT PRINCIPLE

Developer bekerja secara lokal terlebih dahulu.

Flow:

```
VS Code Local

↓

Development Environment

↓

Testing

↓

Commit

↓

Deploy
```

---

# PRODUCTION DEPLOYMENT PRINCIPLE

Production tidak digunakan sebagai tempat eksperimen.

Dilarang:

```
Edit langsung di server production

Testing menggunakan data production

Mengubah database manual tanpa prosedur
```

---

# SOURCE CODE MANAGEMENT

SMART Platform menggunakan Git sebagai version control.

---

# BRANCH PRINCIPLE

Struktur:

```
main

↓

production


develop

↓

development


feature/*

↓

new feature
```

---

# COMMIT RULE

Commit harus:

- Kecil.
- Jelas.
- Mudah dipahami.

Contoh:

```
feat: add inventory stock module

fix: repair login validation

docs: update architecture guide
```

---

# APPLICATION STRUCTURE

Setiap Application mengikuti pola:

```
application/

├── pages

├── modules

├── components

├── services

├── workflows

├── reports

└── configuration
```

---

# APPLICATION CONTENT

Application hanya berisi:

```
Business Logic

Business Rule

Business Workflow

Business Page
```

---

# FORBIDDEN APPLICATION CONTENT

Application tidak boleh memiliki:

```
Authentication

Permission Engine

Database Driver

API Infrastructure

Theme Engine

Workspace Engine

Deployment Logic
```

---

# MODULE DEVELOPMENT

Setiap module harus memiliki:

```
Module

├── Page

├── Service

├── Repository

├── Validation

└── Documentation
```

---

# UI DEVELOPMENT RULE

Gunakan:

```
SMART.UI
```

sebelum membuat component baru.

---

# COMPONENT CREATION RULE

Component baru dibuat jika:

- Digunakan ulang.
- Bersifat umum.
- Tidak memiliki business logic.

---

# DATABASE DEVELOPMENT RULE

Semua akses data melalui:

```
SMART.DB

↓

Repository
```

---

# DILARANG

```
Direct MongoDB Query

Hardcoded Database Connection

Database Logic di Page
```

---

# API DEVELOPMENT RULE

Komunikasi sistem menggunakan:

```
SMART.API
```

---

# DILARANG

```
fetch()

Direct HTTP Request

API Key Hardcoded
```

---

# SECURITY DEVELOPMENT RULE

Setiap fitur harus mempertimbangkan:

```
Authentication

Authorization

Audit

Validation

Data Protection
```

---

# TESTING PROCESS

Testing dilakukan bertahap:

```
Unit Test

↓

Module Test

↓

Integration Test

↓

User Test

↓

Production Release
```

---

# CODE REVIEW

Setiap perubahan besar harus melalui review.

Review meliputi:

- Architecture.
- Security.
- Performance.
- Maintainability.
- Documentation.

---

# DOCUMENTATION FIRST

Sebelum membuat fitur besar:

Wajib membuat:

```
Specification

↓

Design

↓

Implementation
```

---

# AI DEVELOPMENT ASSISTANT RULE

AI coding assistant seperti FreeBuff digunakan sebagai:

```
Developer Assistant

bukan

Autonomous Developer
```

---

# AI RESPONSIBILITY

AI membantu:

- Analisis code.
- Membuat draft.
- Refactoring.
- Dokumentasi.
- Testing support.

---

# AI LIMITATION

AI tidak boleh:

- Mengubah architecture tanpa persetujuan.
- Menghapus security layer.
- Membypass Framework.
- Mengubah production langsung.

---

# DEPLOYMENT FLOW

Standar:

```
Code

↓

Commit

↓

Review

↓

Build

↓

Test

↓

Release

↓

Deploy

↓

Monitor
```

---

# DEPLOYMENT VALIDATION

Setelah deploy:

Periksa:

```
Application Status

API Status

Database Status

Error Log

Performance
```

---

# CHANGE MANAGEMENT

Perubahan besar harus memiliki:

```
Reason

Impact

Plan

Migration

Rollback
```

---

# PRODUCTION SAFETY RULE

Dilarang:

```
Direct Production Coding

Unknown Database Change

Unreviewed Deployment

Removing Security Layer
```

---

# DEVELOPER CHECKLIST

Sebelum coding:

✓ Memahami specification.

✓ Menentukan layer yang benar.

✓ Mengecek Framework capability.

---

Saat coding:

✓ Menggunakan SDK.

✓ Mengikuti architecture.

✓ Tidak membuat duplicate foundation.

---

Sebelum release:

✓ Testing selesai.

✓ Documentation update.

✓ Review selesai.

---

# QUALITY STANDARD

SMART Platform mengikuti:

```
Clean Architecture

SOLID

DRY

KISS

Repository Pattern

Dependency Injection

Separation of Concern
```

---

# LONG TERM OBJECTIVE

Panduan ini dibuat agar:

- Developer baru cepat memahami sistem.
- Kualitas kode konsisten.
- Framework berkembang aman.
- Application berkembang cepat.

---

# FINAL STATEMENT

```
Good Code

builds applications.

Good Architecture

builds platforms.
```

SMART Development Guide memastikan setiap aplikasi dibangun dengan standar yang sama dan menjadi bagian dari ekosistem SMART Platform.

---

**Next Document**

➡ SP-007 - SMART SECURITY ARCHITECTURE