# SP-011 - SMART AUTHENTICATION & IDENTITY ARCHITECTURE

> **Document Code** : SP-011  
> **Document Name** : SMART Authentication & Identity Architecture  
> **Version** : 1.0  
> **Status** : Official  
> **Owner** : PT SMART VISION INDOTAMA  
> **Last Update** : August 2026  

---

# PURPOSE

Dokumen ini mendefinisikan arsitektur Identity dan Authentication pada SMART Platform.

Dokumen ini menjadi standar untuk:

- User Identity.
- Authentication.
- Session Management.
- Single Sign-On.
- Company Context.
- Application Access.
- Security Boundary.

---

# IDENTITY VISION

SMART Platform menggunakan konsep:

> One Identity, Multiple Applications.

Satu identitas pengguna dapat digunakan pada berbagai aplikasi SMART Platform sesuai kewenangan.

---

# IDENTITY ARCHITECTURE POSITION

Identity berada pada layer Framework.

```
User

↓

SMART Identity

↓

SMART Session

↓

Application

↓

Business Process
```

---

# IDENTITY PRINCIPLE

SMART Identity menggunakan prinsip:

```
Centralized Identity

Secure Authentication

Single Session

Least Privilege

Auditable Access
```

---

# IDENTITY DOMAIN

SMART Platform memiliki dua domain identity:

```
CONTROL PLANE IDENTITY

dan

BUSINESS PLANE IDENTITY
```

---

# CONTROL PLANE IDENTITY

Digunakan untuk:

```
SMART Console
```

User:

```
Super Admin

Platform Operator
```

---

# BUSINESS PLANE IDENTITY

Digunakan untuk:

```
Application
```

User:

```
Company Admin

Employee

Operator

Business User
```

---

# USER IDENTITY MODEL

Setiap user memiliki:

```
userId

name

email

credential

status

roles

applications
```

---

# USER IDENTITY RULE

User identity bersifat unik dalam SMART Platform.

Tidak dibuat ulang pada setiap aplikasi.

---

# APPLICATION USER MODEL

Application tidak membuat user sendiri.

Flow:

```
SMART Identity

↓

Application Access

↓

Application Role
```

---

# AUTHENTICATION ARCHITECTURE

Authentication bertugas memastikan:

```
Who are you?
```

---

# AUTHENTICATION FLOW

```
User

↓

Login Request

↓

Identity Service

↓

Credential Validation

↓

Create Session

↓

Application Access
```

---

# AUTHENTICATION METHOD

SMART Platform dapat mendukung:

```
Email Password

Passwordless

OAuth

SSO

Future Biometric
```

---

# PASSWORD SECURITY

Credential harus:

- Terenkripsi.
- Tidak disimpan dalam bentuk plaintext.
- Memiliki password policy.
- Memiliki reset mechanism.

---

# SESSION ARCHITECTURE

Session merupakan pusat context runtime.

---

# SMART.SESSION

Berisi:

```
User

Company

Application

Workspace

Theme

Locale

Permission

Authentication Status
```

---

# SESSION FLOW

```
Login

↓

Create Session

↓

Load User

↓

Load Company

↓

Load Permission

↓

Open Application
```

---

# SESSION RULE

Application tidak boleh membuat:

```
Manual Session

Manual Company Context

Manual Permission Context
```

---

# SINGLE SIGN ON

SMART Platform mendukung konsep:

```
One Login

↓

Multiple Applications
```

---

# EXAMPLE

User login:

```
e-profit.id
```

Kemudian dapat membuka:

```
inventory.e-profit.id

pos.e-profit.id

smartconsole.e-profit.id
```

sesuai hak akses.

---

# APPLICATION ACCESS CONTROL

Tidak semua user dapat membuka semua aplikasi.

Access ditentukan oleh:

```
User

↓

Application Permission

↓

Company Permission

↓

Role
```

---

# COMPANY CONTEXT

Company context menentukan:

```
Data Ownership

Branding

Workspace

Permission
```

---

# COMPANY SWITCHING

User tertentu dapat memiliki akses lebih dari satu company.

Contoh:

```
Holding Admin

Platform Operator

Super Admin
```

---

# COMPANY SWITCHING RULE

Setiap perpindahan company harus:

- Memvalidasi permission.
- Membuat audit log.
- Memperbarui session context.

---

# ROLE ARCHITECTURE

Role adalah kumpulan permission.

---

# ROLE STRUCTURE

```
User

↓

Role

↓

Permission

↓

Action
```

---

# EXAMPLE ROLE

```
Company Admin

Finance Manager

Warehouse Staff

Cashier

Viewer
```

---

# PERMISSION INTEGRATION

Identity hanya memberikan:

```
Who is user
```

Permission menentukan:

```
What user can do
```

---

# ACCESS FLOW

```
Authentication

↓

Identity

↓

Session

↓

Permission Check

↓

Application Feature
```

---

# IMPERSONATION IDENTITY

SMART Platform mendukung impersonation terbatas.

---

# PURPOSE

Digunakan untuk:

- Technical Support.
- Troubleshooting.
- Investigation.

---

# IMPERSONATION RULE

Wajib:

```
Permission

Reason

Duration

Audit Log
```

---

# IDENTITY SECURITY

SMART Identity wajib melindungi:

```
Credential

Session

Token

User Information
```

---

# SESSION SECURITY

Session harus memiliki:

- Expiration.
- Refresh mechanism.
- Revocation.
- Activity tracking.

---

# LOGIN SECURITY

Mendukung:

```
Failed Login Detection

Account Lock

Suspicious Activity Detection
```

---

# AUDIT IDENTITY

Aktivitas identity dicatat:

```
Login

Logout

Failed Login

Password Change

Role Change

Permission Change

Impersonation
```

---

# DEVELOPMENT RULE

Developer wajib:

✓ Menggunakan SMART.Identity.

✓ Menggunakan SMART.Session.

✓ Tidak membuat authentication sendiri.

✓ Tidak menyimpan credential manual.

✓ Menggunakan permission framework.

---

# DILARANG

```
Separate User Database

Duplicate Authentication

Hardcoded Permission

Manual Session Management

Shared Credential
```

---

# IDENTITY SUCCESS CRITERIA

SMART Identity berhasil apabila:

✓ Satu user dapat menggunakan banyak aplikasi.

✓ Security tetap terkontrol.

✓ Company isolation tetap berjalan.

✓ Semua akses dapat diaudit.

✓ Developer tidak membuat authentication ulang.

---

# FINAL STATEMENT

```
SMART Identity

is the foundation

of trust

across SMART Platform.
```

Satu identitas menjadi pintu masuk aman menuju seluruh ekosistem SMART.

---

**Next Document**

➡ SP-012 - SMART MULTI TENANT ARCHITECTURE