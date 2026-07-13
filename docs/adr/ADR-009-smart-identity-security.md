# ADR-009: SMART Identity & Security Architecture

**Status:** Accepted

**Date:** July 13, 2026

**Context:** EPIC-003 — Building a centralized authentication, authorization, and tenant management layer for the SMART Platform.

---

## Decision

SMART Identity & Security terdiri dari empat sub-sistem yang independen namun terintegrasi:

```
┌─────────────────────────────────────────────┐
│           Application Identity              │
│  (app.js, identity.js)                      │
│  Nama aplikasi, versi, environment, origin   │
├─────────────────────────────────────────────┤
│           Authentication Layer              │
│  (auth.js, session.js)                      │
│  Login/logout, session management, token     │
├─────────────────────────────────────────────┤
│           Authorization (RBAC)              │
│  (permission.js, roles.js)                  │
│  Role hierarchy, permission check, wildcard  │
├─────────────────────────────────────────────┤
│           Tenant / Institution Context      │
│  (institution.js, tenant.js)                │
│  Multi-tenant, institution switching         │
└─────────────────────────────────────────────┘
```

### Dependency Direction

```
Application Identity → Auth → Permission
                          ↘
                    Institution / Tenant
```

## 1. Authentication (Auth + Session)

### Session Strategy

- **In-memory session** — sederhana, cocok untuk SPA tanpa server-side session
- Session menyimpan `user`, `token`, `loginTime`, `expiresAt`
- Token adalah UUID sederhana yang di-generate saat login
- Tidak ada JWT (terlalu berat untuk SPA internal) — menggunakan simple token

### User Repository

- User data dipisah dari Auth logic (repository pattern)
- Default in-memory users, bisa di-extend dengan API consumer

### API (backward compatible)

```js
Auth.login(username, password?)  // enhanced with optional password
Auth.logout()                     // unchanged
Auth.isLoggedIn()                 // unchanged
Auth.user()                       // unchanged (returns current user)
Auth.session()                    // NEW — returns session info (token, expiresAt)
Auth.onChange(callback)           // NEW — subscribe to auth state changes
```

## 2. Role-Based Access Control (Permission + Roles)

### Permission String Convention

```
<resource>.<action>
```

| Resource | Actions | Example |
|---|---|---|
| `dashboard` | `view` | `dashboard.view` |
| `barang` | `view`, `create`, `update`, `delete` | `barang.create` |
| `supplier` | `view`, `create` | `supplier.view` |
| `pembelian` | `view`, `create` | `pembelian.view` |
| `report` | `view` | `report.view` |
| `setting` | `manage` | `setting.manage` |

### Wildcard Support

- `barang.*` → grants all barang permissions (view, create, update, delete)
- `*` → superadmin, grants everything

### Role Hierarchy

```
owner (level 100)
  └── manager (level 70)
        └── operator (level 30)
              └── viewer (level 10)
```

Higher level inherits all permissions from lower levels plus their own.

### Permission Engine (standalone)

- Permission engine **tidak bergantung pada Auth**
- Menerima `permissions[]` dan `requiredPermission` → return boolean
- Consumer (Auth/Institution) yang menyediakan permission list

### API (enhanced, backward compatible)

```js
Permission.can("barang.create")           // unchanged — checks current user's role
Permission.canAny(["barang.view", "barang.create"])  // NEW — any of these
Permission.canAll(["barang.view", "barang.create"])  // NEW — all of these
Permission.role(name)                      // NEW — get role definition
Permission.roles()                         // NEW — list all roles
Permission.grant(role, permission)         // NEW — dynamically add permission
Permission.revoke(role, permission)        // NEW — dynamically remove permission
```

## 3. Institution / Tenant Context

### Tenant Model

- Setiap user memiliki `institution` ID
- Permission bisa di-scope per-institution
- Institution memiliki `type` (inventory, company, default) dan `workspace`

### API (enhanced, backward compatible)

```js
Institution.current()            // unchanged
Institution.set(id)              // unchanged
Institution.list()               // NEW — list all institutions
Institution.validate(id)         // NEW — check if institution exists
Institution.byType(type)         // NEW — filter institutions by type
Institution.onChange(callback)   // NEW — subscribe to institution changes
```

## 4. Application Identity

### Identity Object

```js
AppConfig.name              // "Smart Inventory"
AppConfig.version            // "1.0.0"
AppConfig.company            // "PT Smart Vision Indotama"
AppConfig.environment        // "development" | "staging" | "production"
AppConfig.apiUrl             // API base URL
AppConfig.appCode            // NEW — "INV" (unique app identifier)
AppConfig.features           // NEW — enabled feature flags
AppConfig.isDevelopment()    // NEW — convenience method
```

## Rationale

- **Auth/Permission separation** — Permission engine bisa di-test tanpa login session
- **In-memory session** — cukup untuk SPA, tanpa dependency ke backend session store
- **Role hierarchy** — mengurangi duplikasi permission definitions (manager tidak perlu redefine owner permissions)
- **Wildcard** — memudahkan pemberian akses ke seluruh resource
- **Backward compatibility** — semua API lama tetap berfungsi, tidak perlu ubah Inventory code

## Consequences

- Positive: Permission bisa di-test secara independen
- Positive: Auth state changes bisa di-subscribe (reactive UI updates)
- Positive: Role hierarchy mengurangi redundancy
- Negative: In-memory session hilang saat page refresh (perlu re-login atau persistent storage)
- Negative: Wildcard permission bisa terlalu broad jika tidak hati-hati

## Related Decisions

- ADR-001: SMART sebagai Platform
- ADR-003: Vanilla JavaScript
- ADR-006: Layer Independence
- ADR-007: Monorepo Strategy
