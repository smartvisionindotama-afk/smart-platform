# Execution Status

| Roadmap   | Task                                  | Status | Date       | Notes                                                                 |
|-----------|---------------------------------------|--------|------------|-----------------------------------------------------------------------|
| Framework | A-01 Sidebar Fix                      | ✅     | Sprint 1   | Removed module-level `sidebarClickAttached` flag.                     |
| Framework | A-02 Export Fix                       | ✅     | Sprint 1   | Full re-export of all 22 components from `@smart/ui`.                 |
| EPIC-001  | **Company Context → smart-core**      | ✅     | 2026-07-15 | `setCompanyContext`, `getCompanyCode`, `tagWithCompany` dll pindah ke framework. |
| EPIC-001  | **BrandingContext → smart-core**      | ✅     | 2026-07-15 | `BrandingManager` — logo, favicon, companyName, workspace, theme.     |
| EPIC-001  | **Company Types → smart-core**        | ✅     | 2026-07-15 | `COMPANY_TYPES` 16 jenis.                                             |
| EPIC-001  | **Persistence → smart-data**          | ✅     | 2026-07-15 | `createStore()` dari Inventory pindah.                                |
| EPIC-001  | **MongoDB Connection → smart-data**   | ✅     | 2026-07-15 | `dbConfig`, `checkConnection`, `createApiRepository`.                 |
| EPIC-001  | **BaseRepository → smart-data**       | ✅     | 2026-07-15 | `BaseRepository` + `InMemoryRepository`.                              |
| EPIC-001  | **API Fallback → smart-api**          | ✅     | 2026-07-15 | 10 API fallback utilities.                                            |
| EPIC-001  | **PageContainer → smart-ui**          | ✅     | 2026-07-15 | `PageContainer()` + `renderBreadcrumb()`.                             |
| EPIC-001  | **Settings Company → smart-ui**       | ✅     | 2026-07-15 | `SettingsCompanyModule` (DI-based).                                   |
| EPIC-001  | **Settings User → smart-ui**          | ✅     | 2026-07-15 | `SettingsUserModule` (DI-based).                                      |
| EPIC-001  | **Settings Role → smart-ui**          | ✅     | 2026-07-15 | `SettingsRoleModule` (DI-based).                                      |
| EPIC-001  | **Settings Permission → smart-ui**    | ✅     | 2026-07-15 | `SettingsPermissionModule` (DI-based).                                |
| EPIC-001  | **FrameworkContext → smart-core**     | ✅     | 2026-07-15 | `framework` singleton — unified state.                                |
| EPIC-001  | **Branding wired to Sidebar/Shell**   | ✅     | 2026-07-15 | Sidebar auto-reads dari BrandingContext.                              |
| EPIC-001  | **Server Models: status + audit**     | ✅     | 2026-07-15 | `status`, `createdBy`, `updatedBy` di semua model.                    |
| **EPIC-004** | **Impersonation Manager → smart-core** | ✅     | 2026-07-15 | `ImpersonationManager` — Login As Company Admin, session with expiry, notify on start/end/expired. |
| **EPIC-004** | **Audit Logger → smart-core**         | ✅     | 2026-07-15 | `AuditLogger` — mencatat impersonation, login, logout. Convenience methods: logImpersonationStart, logImpersonationEnd, logLogin, logLogout. |
| **EPIC-004** | **Platform Manager → smart-core**     | ✅     | 2026-07-15 | `PlatformManager` — registry aplikasi (8 built-in apps), company-app mapping, enable/disable apps per company. |
| **EPIC-004** | **Super Admin user + role**           | ✅     | 2026-07-15 | User `superadmin`/`superadmin123` dengan role `superadmin` (level 200, wildcard permissions). |
| **EPIC-004** | **Topbar Impersonation Badge → smart-ui** | ✅ | 2026-07-15 | Badge merah `LOGIN AS [Company] (Admin Perusahaan) Support Mode Active` + tombol `Kembali ke Super Admin`. |
| **EPIC-004** | **AppShell impersonation support**    | ✅     | 2026-07-15 | `AppShell` menerima `impersonation` + `onExitImpersonation` params, diteruskan ke Topbar. |
| **EPIC-004** | **Framework exports updated**         | ✅     | 2026-07-15 | `smart-core/index.js` dan `package.json` mengekspor impersonation, audit, platform. |
| **EPIC-004** | **Platform Dashboard (Super Admin)**     | ✅     | 2026-07-15 | Halaman dashboard Super Admin dengan apps grid + company management. Login superadmin → dashboard. |
| **EPIC-004** | **Company Management Page**              | ✅     | 2026-07-15 | Tabel perusahaan + 5 action buttons: ✏️ Edit, 🔑 Login As, 👁️ Profile, 📋 Subs, ⛔ Disable. Form modal, detail modal, subscription toggle, confirm disable. |
| **EPIC-004** | **Impersonation Flow**                   | ✅     | 2026-07-15 | Pilih app → pilih company → Login As Admin → sessionStorage → reload → AppShell + impersonation badge. Kembali ke Super Admin. |
| Inventory | Sprint 1 — Authentication             | ✅     | 2026-07-14 | Login page, logout, session, protected routes. Users: admin/admin123, operator/operator123. |
| Inventory | Sprint 1 — Application Shell          | ✅     | 2026-07-14 | AppShell, Sidebar, Topbar, Breadcrumb.                                |
| Inventory | Sprint 1 — Dashboard                  | ✅     | 2026-07-14 | Enhanced dashboard with stat cards, welcome banner.                   |
| Inventory | Sprint 1 — Database Layer             | ✅     | 2026-07-14 | MongoDB abstraction, framework repositories.                          |
| Inventory | Barang CRUD                           | ✅     | 2026-07-14 | Full CRUD with SMART UI components. 12 seed items.                    |
| Inventory | Settings Company CRUD                 | ✅     | 2026-07-14 | Full CRUD via framework `SettingsCompanyModule`.                      |
| Inventory | Settings User CRUD                    | ✅     | 2026-07-14 | Full CRUD with role + company assignment.                             |
| Inventory | Settings Role CRUD                    | ✅     | 2026-07-14 | Full CRUD with level hierarchy.                                       |
| Inventory | Settings Permission                   | ✅     | 2026-07-14 | Role-permission matrix with expandable groups.                        |
| Inventory | Multi-Tenant Data Isolation           | ✅     | 2026-07-14 | All entities scoped by companyCode.                                   |
| Inventory | Supplier CRUD                         | ✅     | 2026-07-15 | Full CRUD with SMART UI components. 8 seed items.                     |
| **Framework** | **Company SDK Refactoring**        | ✅     | 2026-07-16 | Company menjadi SDK: company-manager, company-session, company-storage, company-validator. SMART.Session global singleton. BaseRepository auto-company scoping. SMART namespace (SMART.Session, SMART.Company, SMART.Permission, etc). |
| **Framework** | **Company Types Simplified**        | ✅     | 2026-07-16 | COMPANY_TYPES disederhanakan: PT, CV, Perorangan, BUMDes, Koperasi, Pesantren, Pemerintah, Lainnya. |
| **Framework** | **Branding Decoupled**              | ✅     | 2026-07-16 | BrandingManager tidak lagi bergantung pada company-context. Menerima data via loadFromCompany(). |
| **Framework** | **Inventory Data Layer Cleanup**    | ✅     | 2026-07-16 | Hapus dependency langsung ke filterByCompany/tagWithCompany dari data services. Gunakan BaseRepository auto-scoping. |
| **Framework** | **Architecture Refinement (13 Phases)** | ✅ | 2026-07-16 | SMART Framework jadi Enterprise SDK: SMART.Session (nested), SMART.Company (15 methods), SMART.DB, SMART.API, SMART.UI, SMART.Permission (namespace), SMART.Platform (enhanced), SMART.Audit, SMART.Impersonation. |
| **EPIC-005** | **Architecture Design Document**      | ✅ | 2026-07-16 | `docs/epic-005-architecture-design.md` — Event Bus, DI, Plugin, Lifecycle, Config, CLI, Generators. 5 conflicts identified, solutions designed. |
| **EPIC-005** | **Event Bus**                          | ⬜ | Sprint 5   | Wrapping existing onChange, backward compat. No breaking changes. |
| **EPIC-005** | **Configuration Provider**             | ⬜ | Sprint 5   | Priority chain: ENV → localStorage → workspace.json → defaults. |
| **EPIC-005** | **Lifecycle Hooks**                    | ⬜ | Sprint 5   | State machine: bootstrap → init → ready → running → destroy. |
| **EPIC-005** | **DI Container**                       | ⬜ | Sprint 6   | Optional — facade tetap langsung import. Register/resolve pattern. |
| **EPIC-005** | **Plugin System**                      | ⬜ | Sprint 6   | SMART.use(plugin), SMART.extend(name, module). Plugin lifecycle. |
| **EPIC-005** | **CLI Architecture**                   | ⬜ | Sprint 7   | New package: smart-cli. Commands: init, generate, build, dev. |
| **EPIC-005** | **Module Generator**                   | ⬜ | Sprint 7   | New package: smart-generator. CRUD module from template. |
| **EPIC-005** | **Application Generator**              | ⬜ | Sprint 7   | Full app from template. Depends on Module Generator. |
| Inventory | Pembelian CRUD                        | ⬜ | —          | Placeholder only.                                                     |
| Inventory | Customer CRUD                         | ⬜     | —          | Placeholder only.                                                     |

## ═══════════════════════════════════════════════
## COMPANY SDK REFACTORING (2026-07-16)
## ═══════════════════════════════════════════════

### Company SDK — New Architecture

Folder `packages/smart-core/src/company/` diubah menjadi Company SDK dengan struktur berikut:

| Module | File | Description |
|--------|------|-------------|
| Company Context | `company-context.js` | (Dipertahankan) Module-level context dengan backward-compatible function API (setCompanyContext, getCompanyCode, tagWithCompany, filterByCompany). |
| Branding | `branding.js` | `BrandingManager` — decoupled dari company-context. Menerima data via `loadFromCompany()` dan `setOverrides()`. Menyediakan logo, favicon, companyName, workspace, theme, dll. |
| Company Types | `company-types.js` | `COMPANY_TYPES` — Disederhanakan menjadi 8 jenis: PT, CV, Perorangan, BUMDes, Koperasi, Pesantren, Pemerintah, Lainnya. |
| **Company Storage** | `company-storage.js` | **NEW** `SmartStorage` — storage abstraction dengan localStorage fallback ke in-memory Map. Prefix "smart_company_". |
| **Company Validator** | `company-validator.js` | **NEW** Validation helpers: validateCompanyCode(), validateCompanyName(), validateEmail(), validatePhone(), validateCompanyType(), validateCompanyData(). |
| **Company Session** | `company-session.js` | **NEW** `CompanySession` — mengelola session perusahaan. Fields: userId, companyId, companyCode, companyName, companyType, applicationId, workspace, role, permissions, logo, theme. Methods: create(), get(), update(), save(), load(), restore(), destroy(), isActive(). |
| **Company Manager** | `company-manager.js` | **NEW** `CompanyManager` — orchestrator. Methods: setCompany(), getCompany(), clear(), switchCompany(), loadBranding(), loadWorkspace(). Memiliki onChange() subscribers. |

### SMART.Session — Global Session Singleton

**File:** `packages/smart-core/src/session/index.js` (NEW)

Global singleton `SMART.Session` yang dapat dipanggil dari seluruh aplikasi:

```js
SMART.Session.userId        // Current user ID
SMART.Session.companyId     // Current company database ID
SMART.Session.companyCode   // Current company code
SMART.Session.companyName   // Current company display name
SMART.Session.companyType   // Company type (PT, CV, etc.)
SMART.Session.workspace     // Active workspace
SMART.Session.role          // Current user role
SMART.Session.permissions   // Current user permissions
SMART.Session.logo          // Company logo URL
SMART.Session.theme         // Active theme
```

Methods: `init()`, `getState()`, `save()`, `restore()`, `destroy()`, `update()`

### SMART Namespace — Unified Public API

**File:** `packages/smart-core/src/index.js` (UPDATED)

```js
SMART.Session.companyCode       // Session
SMART.Company.get()              // Company Manager
SMART.Company.branding()         // Branding
SMART.Company.switch()           // Switch Company
SMART.Permission.can()           // Permission check
SMART.Platform.currentApplication()  // Platform
SMART.Audit.log()                // Audit
SMART.Impersonation.loginAs()    // Impersonation
```

`SMART` juga di-attach ke `globalThis` untuk akses dari console.

### BaseRepository — Auto Company Scoping

**File:** `packages/smart-data/src/base-repository.js` (UPDATED)

`BaseRepository` sekarang otomatis membaca companyCode dari `SMART.Session`:

```js
// Methods baru:
_getCompanyCode()  // Reads from SMART.Session
_tagWithCompany()  // Auto-tags data with companyCode
_filterByCompany() // Auto-filters items by companyCode
```

Programmer tidak perlu lagi memanggil `getCompanyCode()`, `tagWithCompany()`, atau `filterByCompany()` secara manual.

### Inventory Data Layer — Cleanup

| File | Change |
|------|--------|
| `settings-data.js` | Hapus import `filterByCompany`, `tagWithCompany` dari framework. Gunakan local helper `_filterData()` / `_tagData()` yang membaca dari SMART.Session. |
| `barang-data.js` | Hapus import `filterByCompany`, `tagWithCompany` dari framework. Gunakan local helper. |
| `supplier-data.js` | Hapus import `filterByCompany`, `tagWithCompany` dari framework. Gunakan local helper. |
| `api.js` | Mempertahankan `getCompanyCode()` untuk header `x-company-code` pada API calls. |

### FrameworkContext — Updated

**File:** `packages/smart-core/src/context/index.js` (UPDATED)

Sekarang subscribe ke:
- `Auth.onChange()` — auth state
- `companySession.onChange()` — session changes
- `companyManager.onChange()` — company manager changes
- `branding.onChange()` — branding changes
- `Permission.onChange()` — permission changes

### Backward Compatibility

Semua export lama tetap berfungsi:
- `setCompanyContext()`, `getCompanyCode()`, `getCompanyName()`, `clearCompanyContext()`, `hasCompanyContext()`, `tagWithCompany()`, `filterByCompany()`
- `branding`, `companyManager`
- `COMPANY_TYPES`, `getCompanyTypeOptions()`
- `framework`, `impersonation`, `audit`, `platform`

### Architecture Diagram (Updated)

```
@smart/core                             Inventory (thin)
──────────                             ────────────────
  ├── auth/                            apps/inventory
  ├── permission/                        ├── data/
  │   └── roles.js ← Namespace perms    │   ├── settings-data.js
  ├── company/     ← COMPANY SDK        │   ├── barang-data.js
  │   ├── company-manager.js             │   ├── supplier-data.js
  │   ├── company-session.js             │   ├── api.js
  │   ├── company-storage.js             │   ├── superadmin-data.js
  │   ├── company-validator.js           │   └── [framework re-exports]
  │   ├── branding.js                    ├── pages/ (7 pages)
  │   ├── company-context.js  ← @deprecated  ├── config/
  │   └── company-types.js               └── router/
  ├── session/       ← SMART.Session (nested)
  ├── context/       ← FrameworkContext
  ├── impersonation/
  ├── audit/
  └── platform/     ← Enhanced (workspace, subscription)

@smart/data
  ├── base-repository.js  ← Auto company + audit fields
  ├── DB SDK               ← SMART.DB namespace
  └── ...

@smart/api
  ├── fallback utilities   ← API-first with local fallback
  └── API SDK              ← SMART.API namespace

@smart/ui
  ├── components/          ← 22 UI components
  ├── layouts/             ← Sidebar, Topbar, Shell
  ├── module/settings/     ← Company, User, Role, Permission
  └── UI SDK               ← SMART.UI namespace
```

## ═══════════════════════════════════════════════
## ARCHITECTURE REFINEMENT (2026-07-16)
## ═══════════════════════════════════════════════

### Ringkasan Perubahan

Framework SMART telah ditransformasi menjadi **Enterprise SDK** dengan 9 namespace publik:

| SDK | Namespace | Package | Status |
|-----|-----------|---------|--------|
| Session | `SMART.Session` | @smart/core | ✅ Nested object structure |
| Company | `SMART.Company` | @smart/core | ✅ 15 methods |
| Database | `SMART.DB` | @smart/data | ✅ 10 methods |
| API | `SMART.API` | @smart/api | ✅ 7 methods |
| UI | `SMART.UI` | @smart/ui | ✅ 11 components |
| Permission | `SMART.Permission` | @smart/core | ✅ Namespace-based |
| Platform | `SMART.Platform` | @smart/core | ✅ Enhanced |
| Audit | `SMART.Audit` | @smart/core | ✅ Global service |
| Impersonation | `SMART.Impersonation` | @smart/core | ✅ Global service |

### ═══════════════════════════════════════════════
### FACADE ARCHITECTURE — PUBLIC SDK (2026-07-16)
### ═══════════════════════════════════════════════

Setelah Architecture Refinement, framework ditingkatkan dengan **Facade Pattern**:

**ONE PACKAGE = ONE PUBLIC FACADE**

Programmer aplikasi TIDAK BOLEH mengetahui implementasi internal framework.
Programmer cukup mengenal `SMART.*` dan setiap package hanya mengekspos SATU Facade.

#### Architecture

| Package | Facade File | Public API | Internal Implementation |
|---------|-------------|------------|------------------------|
| @smart/core | `facade.js` | `SMART` (9 namespaces) | auth, permission, company/*, session, context, impersonation, audit, platform |
| @smart/data | `db-facade.js` | `DB` | base-repository, mongodb, persistence, cache, state |
| @smart/api | `api-facade.js` | `API` | client, error, interceptors, fallback |
| @smart/ui | `ui-facade.js` | `UI` | components/*, layouts/*, modules/* |

#### Cara Penggunaan

```js
// ✅ BENAR — Facade
import { SMART } from "@smart/core";
import { DB } from "@smart/data";
import { API } from "@smart/api";
import { UI } from "@smart/ui";

SMART.Session.company()
SMART.Company.switch()
DB.collection("barang").find({ page: 1 })
API.get("/api/barang")
UI.Modal({ open: true, title: "Hello" })

// ⚠️ @deprecated — masih berfungsi, akan dihapus
import { Auth, Permission, branding } from "@smart/core";
import { BaseRepository } from "@smart/data";
import { createClient } from "@smart/api";
import { Modal, Toast } from "@smart/ui";
```

#### SMART Facade — Full API Reference

```js
SMART.Session.create(data)      // Buat session baru
SMART.Session.restore()          // Restore dari storage
SMART.Session.save()             // Simpan ke storage
SMART.Session.destroy()          // Hapus session
SMART.Session.refresh()          // Refresh dari storage
SMART.Session.user()             // { id, name, email, role, permissions }
SMART.Session.company()          // { id, code, name, type, logo, branding, workspace }
SMART.Session.application()      // { id, code, name, version }
SMART.Session.workspace()        // String
SMART.Session.theme()            // "light" | "dark"

SMART.Company.get()              // Current company info
SMART.Company.set(code, name)    // Set company context
SMART.Company.clear()            // Clear company
SMART.Company.switch(code)       // Switch company
SMART.Company.branding()         // { logo, favicon, companyName, theme, workspace }
SMART.Company.validate(data)     // { valid, errors }
SMART.Company.types()            // ["PT", "CV", ...]
SMART.Company.exists()           // Boolean
SMART.Company.logo()             // String|null
SMART.Company.theme()            // String

SMART.DB.collection(name)        // Collection proxy
SMART.DB.find(collection, p)     // Shorthand
SMART.DB.findOne(c, id)          // Shorthand
SMART.DB.insert(c, d)            // Shorthand

SMART.API.get(url, params)       // HTTP GET
SMART.API.post(url, body)        // HTTP POST
SMART.API.put(url, body)         // HTTP PUT
SMART.API.delete(url)            // HTTP DELETE
SMART.API.upload(url, fd)        // File upload
SMART.API.download(url)          // File download

SMART.Permission.can(perm)       // Check permission
SMART.Permission.cannot(perm)    // Inverse check
SMART.Permission.hasRole(role)   // Check role
SMART.Permission.assign(r, p)    // Grant permission
SMART.Permission.revoke(r, p)    // Revoke permission

SMART.Platform.currentApp()      // Current application
SMART.Platform.currentCompany()  // Current company
SMART.Platform.loginAsCompany()  // Impersonate
SMART.Platform.subscription()    // Check subscription

SMART.Audit.log(entry)           // Record audit entry
SMART.Audit.history(filters)     // Get audit history

SMART.Impersonation.loginAs(s)   // Start impersonation
SMART.Impersonation.isImpersonating()  // Check
SMART.Impersonation.end()        // End impersonation

SMART.UI.Modal(opts)             // Open modal
SMART.UI.Toast(opts)             // Show toast
SMART.UI.PageContainer(opts)     // Page layout
```

#### Package Exports (Clean)

**@smart/core (index.js):**
```js
export { SMART, default } from "./facade.js";                // ✅ PRIMARY
// @deprecated backward compat exports berikutnya
```

**@smart/data (index.js):**
```js
export { DB } from "./db-facade.js";                           // ✅ PRIMARY
// @deprecated backward compat exports berikutnya
```

**@smart/api (index.js):**
```js
export { API } from "./api-facade.js";                         // ✅ PRIMARY
// @deprecated backward compat exports berikutnya
```

**@smart/ui (index.js):**
```js
export { UI, loadUI } from "./ui-facade.js";                  // ✅ PRIMARY
// @deprecated backward compat exports berikutnya
```

#### New Files Created (4)

| File | Purpose |
|------|---------|
| `packages/smart-core/src/facade.js` | SMART namespace — 9 sub-namespaces, globalThis.SMART |
| `packages/smart-data/src/db-facade.js` | DB namespace — collection CRUD + auto companyCode scoping |
| `packages/smart-api/src/api-facade.js` | API namespace — HTTP methods + auto company headers |
| `packages/smart-ui/src/ui-facade.js` | UI namespace — 12 components + globalThis.SMART.UI |

#### Files Modified (4)

| File | Change |
|------|--------|
| `smart-core/src/index.js` | Hanya export SMART facade + @deprecated backward compat |
| `smart-data/src/index.js` | Hanya export DB facade + @deprecated backward compat |
| `smart-api/src/index.js` | Hanya export API facade + @deprecated backward compat |
| `smart-ui/src/index.js` | Hanya export UI facade + @deprecated backward compat |

#### DB Enhancement: Auto Multi-Tenant

`DB.collection().find()` sekarang otomatis menambahkan `companyCode` filter:
```js
// Sebelum
DB.collection("barang").find({ page: 1 })
// → GET /api/barang?page=1 (SEMUA company)

// Sesudah
DB.collection("barang").find({ page: 1 })
// → GET /api/barang?page=1&companyCode=XXX (HANYA company saat ini)
```

#### Test Results
- ✅ **508 tests passing** — semua test suite sukses
- ✅ Syntax check pada semua file Facade
- ✅ Code review approved

### Perubahan Detail per Phase

#### PHASE 1: Deprecated API
Fungsi berikut ditandai `@deprecated` di `company-context.js`:
- `setCompanyContext()` → ganti dengan `SMART.Company.set()`
- `getCompanyCode()` → ganti dengan `SMART.Session.get("company.code")`
- `getCompanyName()` → ganti dengan `SMART.Session.get("company.name")`
- `clearCompanyContext()` → ganti dengan `SMART.Company.clear()`
- `hasCompanyContext()` → ganti dengan `SMART.Session.get("company.code")` (bukan `isAuthenticated()`, karena company context ≠ user login)
- `tagWithCompany()` → ganti dengan `BaseRepository._tagWithCompany()`
- `filterByCompany()` → ganti dengan `BaseRepository._filterByCompany()`

#### PHASE 2: SMART.Session — Nested Object Structure
```js
SMART.Session.user.id
SMART.Session.user.name
SMART.Session.user.email
SMART.Session.user.role
SMART.Session.company.id
SMART.Session.company.code
SMART.Session.company.name
SMART.Session.company.type
SMART.Session.company.logo
SMART.Session.company.branding
SMART.Session.company.workspace
SMART.Session.application.id
SMART.Session.application.code
SMART.Session.application.name
SMART.Session.application.version
SMART.Session.theme
SMART.Session.locale
SMART.Session.authenticated
```

Methods: `create()`, `restore()`, `save()`, `refresh()`, `destroy()`, `get(path)`

#### PHASE 3: SMART.Company — Full API
```
get(), set(), clear(), switchTo(), switch(),
branding(), validate(), types(), typeOptions(),
logo(), theme(), workspace(), tag(), filter(),
getCode(), getName(), loadBranding(), loadWorkspace()
```

#### PHASE 4-5: SMART.DB — Database SDK
```
DB.collection(name).find(params)
DB.collection(name).findOne(id)
DB.collection(name).insert(data)
DB.collection(name).update(id, data)
DB.collection(name).delete(id)
DB.collection(name).aggregate(pipeline)
DB.collection(name).transaction(operations)
DB.collection(name).batch(docs)
DB.collection(name).watch(pipeline)

// Shorthands:
DB.find(collection, params)
DB.findOne(collection, id)
DB.insert(collection, data)
DB.aggregate(collection, pipeline)
DB.batch(collection, docs)
```

`InMemoryRepository.create()` otomatis menambahkan:
- `companyCode` (dari SMART.Session)
- `createdBy`, `updatedBy` (dari SMART.Session.user.id)
- `createdAt`, `updatedAt` (timestamp)

#### PHASE 6: SMART.API — API SDK
```
API.get(url, params, opts)
API.post(url, body, opts)
API.put(url, body, opts)
API.patch(url, body, opts)
API.delete(url, opts)
API.upload(url, formData, opts)
API.download(url, opts)
```

Aplikasi tidak boleh memakai fetch() secara langsung.

#### PHASE 7: SMART.UI — UI SDK
```
UI.PageContainer(opts)
UI.Modal(opts)
UI.Table(opts)
UI.Form(opts)
UI.Button(opts)
UI.Sidebar(opts)
UI.Topbar(opts)
UI.Notification(opts)  // Toast alias
UI.Loading(opts)       // Skeleton alias
UI.Dialog(opts)
UI.Toast(opts)
UI.load()              // Initialize UI
```

#### PHASE 8: Platform Enhancement
- `getWorkspace(companyId, appSlug)` — workspace per company-app
- `getCurrentApplication()` — app dari session
- `getCurrentCompany()` — company dari session
- `version` field pada Application
- `tier` field pada CompanyApp (subscription tier)

#### PHASE 9: Namespace-based Permissions
```
// Format: {application}.{resource}.{action}
inventory.dashboard.view
inventory.barang.read
inventory.barang.create
inventory.stock.adjust
settings.company.edit
settings.user.manage
settings.permission.manage
```

#### PHASE 10-12: Public SDK
Semua namespace terdaftar di `globalThis.SMART`:
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
```

### Migration Guide

**Untuk aplikasi yang sudah ada (Inventory):**

1. Ganti `getCompanyCode()` → `SMART.Session.get("company.code")`
2. Ganti `tagWithCompany(data)` → `BaseRepository._tagWithCompany(data)`
3. Ganti `filterByCompany(items)` → `BaseRepository._filterByCompany(items)`
4. Ganti `setCompanyContext()` → `SMART.Company.set()`
5. Ganti permission `barang.view` → `inventory.barang.read`
6. Ganti permission `settings-user.view` → `settings.user.manage`
7. Inisialisasi: `SMART.DB.init(DB)` dan `SMART.API.init(API)` di main.js

### Deprecated API
| Function | Replacement |
|----------|-------------|
| `setCompanyContext()` | `SMART.Company.set()` |
| `getCompanyCode()` | `SMART.Session.get("company.code")` |
| `getCompanyName()` | `SMART.Session.get("company.name")` |
| `clearCompanyContext()` | `SMART.Company.clear()` |
| `hasCompanyContext()` | `SMART.Session.get("company.code")` |
| `tagWithCompany()` | `BaseRepository._tagWithCompany()` |
| `filterByCompany()` | `BaseRepository._filterByCompany()` |
| Permission `*.view` | Permission `{app}.{resource}.read` |

### Test Results
- ✅ **508 tests passing** — semua test suite sukses
- ✅ Permission tests updated untuk namespace format
- ✅ Menu config updated untuk namespace permissions
- ✅ Permission catalog updated di settings-data

## ═══════════════════════════════════════════════
## FRAMEWORK CLEANUP (2026-07-16)
## ═══════════════════════════════════════════════

### Ringkasan

Membersihkan framework dan memastikan konsistensi arsitektur setelah Facade Architecture:
1. Company-context.js menjadi pure wrapper ke SMART.Company/SMART.Session
2. Export internal dipindahkan ke @deprecated
3. Tidak ada duplicate class/export/circular import
4. Setiap package memiliki SATU public entry point

### Perubahan

| File | Perubahan |
|------|-----------|
| `packages/smart-core/src/company/company-context.js` | Semua fungsi jadi WRAPPER — delegate ke SMART.Company/SMART.Session. Fallback minimal hanya jika SMART belum siap. Hapus duplicate CompanyManager class. |
| `packages/smart-core/src/company/index.js` | LEGACY COMPATIBILITY LAYER header. @deprecated di setiap export legacy. |
| `packages/smart-api/src/index.js` | `apiGetCompanyCode`, `apiHeaders` dipindah dari PRIMARY API ke @deprecated. |
| `docs/execution_status.md` | Ditambahkan section FRAMEWORK CLEANUP. |
| `apps/inventory/src/main.js` | Migrasi `setCompanyContext`/`clearCompanyContext`/`getCompanyCode` ke `SMART.Company.set()`/`SMART.Company.clear()`/`SMART.Session.get("company.code")`. |

### Architecture (Final)

```
Application (Reference: Inventory)
        │
        ▼
SMART Facade  ←  import { SMART } from "@smart/core"
  ├── SMART.Session      — Session SDK
  ├── SMART.Company      — Company SDK
  ├── SMART.DB           — Database SDK (init required)
  ├── SMART.API          — API SDK (init required)
  ├── SMART.UI           — UI SDK (via globalThis)
  ├── SMART.Permission   — Permission SDK
  ├── SMART.Platform     — Platform SDK
  ├── SMART.Audit        — Audit SDK
  └── SMART.Impersonation — Impersonation SDK
        │
        ▼
Internal SDK (tersembunyi)
  ├── auth/, permission/, company/*, session/
  ├── platform/, audit/, impersonation/, context/
  └── @smart/data, @smart/api, @smart/ui
        │
        ▼
Infrastructure (MongoDB, localStorage, fetch, etc.)
```

### Public Entry Points

| Package | Import | Status |
|---------|--------|--------|
| @smart/core | `import { SMART } from "@smart/core"` | ✅ Stable |
| @smart/data | `import { DB } from "@smart/data"` | ✅ Stable |
| @smart/api | `import { API } from "@smart/api"` | ✅ Stable |
| @smart/ui | `import { UI } from "@smart/ui"` | ✅ Stable |

### Legacy yang Dipertahankan (Backward Compatibility)

| File | Alasan |
|------|--------|
| `company-context.js` | Aplikasi lama (Inventory) masih menggunakan `setCompanyContext()`, `getCompanyCode()` |
| `@smart/core` deprecated exports | Aplikasi lama import `Auth`, `Permission`, `branding`, dll |
| `@smart/data` deprecated exports | Aplikasi lama import `BaseRepository`, `InMemoryRepository` |
| `@smart/api` deprecated exports | Aplikasi lama import `apiListFallback`, `apiFetch`, dll |
| `@smart/ui` deprecated exports | Aplikasi lama import `Modal`, `Toast`, `Table` langsung |

### Technical Debt (Remaining)

| Item | Priority | Notes |
|------|----------|-------|
| `SMART.DB.init()` & `SMART.API.init()` belum di-wire | Low | Untuk akses SMART.DB/API langsung |
| `UI.Form` belum ada di library | Low | Buat komponen jika dibutuhkan |
| `hasRole()` compare display name bukan role key | Low | `hasRole("superadmin")` vs "Super Admin" |
| Inventory import `@smart/ui/layouts`, `@smart/ui/modules` | Low | Bypass facade, tapi backward compat |
| Deprecated API masih diexport | Low | Untuk backward compatibility, akan dihapus setelah migrasi penuh |

## Legend
- ✅ Completed — Fitur selesai dan stabil
- 🔄 Transition — Masih ada, tapi diganti dengan API baru
- ⬜ Planned — Belum dimulai
