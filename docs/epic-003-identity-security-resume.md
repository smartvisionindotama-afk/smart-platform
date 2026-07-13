# EPIC-003: SMART Identity & Security Foundation

**Status:** ✅ Complete
**Date:** July 13, 2026

---

## Architecture Decision Record

| ADR | Title | Status |
|---|---|---|
| **ADR-009** | SMART Identity & Security Architecture | Accepted |

---

## Milestone Summary

### M1: Permission Engine + RBAC (51 tests)

| File | Description |
|---|---|
| `src/permission/engine.js` | Pure permission matching engine with wildcard support (`*`, `resource.*`) |
| `src/permission/roles.js` | Role definitions with hierarchy: viewer(10) → operator(30) → manager(70) → owner(100) |
| `src/permission/permission.js` | Refactored user-aware facade, backward compatible API |

**API additions:** `canAny()`, `canAll()`, `role()`, `roles()`, `grant()`, `revoke()`, `setOverride()`, `onChange()`

### M2: Auth Layer + Session Manager (40 tests)

| File | Description |
|---|---|
| `src/auth/session.js` | In-memory session store with `smt_` token, expiry, CRUD |
| `src/auth/auth.js` | Enhanced with session support, password validation |

**API additions:** `token()`, `session()`, `validateToken()`, `listUsers()`, `getUser()`, `onChange()`

### M3: Institution/Tenant Context (21 tests)

| File | Description |
|---|---|
| `src/institution/institution.js` | Enhanced with validation, queries, onChange |

**API additions:** `list()`, `byType()`, `exists()`, `get()`, `workspace()`, `isType()`, `onChange()`

### M4: Application Identity (15 tests)

| File | Description |
|---|---|
| `src/app/app.js` | Enhanced with identity metadata, feature flags, environment checks |

**API additions:** `appCode`, `features`, `isDevelopment()`, `isStaging()`, `isProduction()`, `isEnabled()`, `setFeature()`, `identity()`

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           Application Identity              │
│  app.js: appCode, version, features          │
├─────────────────────────────────────────────┤
│           Authentication Layer              │
│  auth.js + session.js                        │
│  Login/logout, session with token, onChange  │
├─────────────────────────────────────────────┤
│           Authorization (RBAC)              │
│  permission.js + engine.js + roles.js        │
│  Role hierarchy, wildcard matching, onChange │
├─────────────────────────────────────────────┤
│           Tenant / Institution Context      │
│  institution.js                              │
│  Multi-tenant switching, queries, onChange   │
└─────────────────────────────────────────────┘
```

### Dependency Direction

```
AppConfig
    └── Auth → Permission (via Auth.user())
          └── Institution (independent)
```

## Test Results

```
npm run verify
├── lint:      0 errors, 6 warnings ✅
├── test:      381/381 passed (13 files) ✅
└── build:     3 assets, 243ms ✅
```

### Test Breakdown

| Test File | Tests | Milestone |
|---|---|---|
| `permission.test.js` | 51 | M1 |
| `auth-enhanced.test.js` | 40 | M2 |
| `institution-enhanced.test.js` | 21 | M3 |
| `app-identity.test.js` | 15 | M4 |
| `auth.test.js` (original) | 10 | Pre-EPIC-003 |
| `button.test.js` | 15 | EPIC-002 |
| Others (Phase 1/2) | 229 | EPIC-001/002 |
| **Total** | **381** | |

## Commit History

```
b73d9dc EPIC-003 M4: Application Identity
be4d96b EPIC-003 M3: Institution/Tenant Context
b62f29a EPIC-003 M2: Auth Layer + Session Manager
17ec82b EPIC-003 M1: Permission Engine + RBAC
86255d1 ADR-009: SMART Identity & Security Architecture
```

## ADR Compliance

- **ADR-003** (Vanilla JS): No frameworks, pure JS modules ✅
- **ADR-006** (Layer Independence): Core has no knowledge of UI ✅
- **ADR-007** (Monorepo): All code in `packages/smart-core/` ✅
- **ADR-009** (Identity Architecture): Fully implemented ✅

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Permission engine separate from Auth** | Engine is pure function, testable without Auth dependency |
| **In-memory sessions** | Sufficient for internal SPA, no backend dependency |
| **Role hierarchy** | Higher levels inherit all lower level permissions, reducing duplication |
| **Wildcard `*`** | Owner role has `*` granting everything; `resource.*` grants all actions |
| **Backward compatibility** | All original APIs preserved — no Inventory changes needed |
