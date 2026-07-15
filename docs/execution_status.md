# Execution Status

| Roadmap   | Task                                  | Status | Date       | Notes                                                                 |
|-----------|---------------------------------------|--------|------------|-----------------------------------------------------------------------|
| Framework | A-01 Sidebar Fix                      | ✅     | Sprint 1   | Removed module-level `sidebarClickAttached` flag.                     |
| Framework | A-02 Export Fix                       | ✅     | Sprint 1   | Full re-export of all 22 components from `@smart/ui`.                 |
| EPIC-001  | **Company Context → smart-core**      | ✅     | 2026-07-15 | `setCompanyContext`, `getCompanyCode`, `tagWithCompany` dll pindah ke framework. + `CompanyManager` class + `companyManager` singleton. |
| EPIC-001  | **BrandingContext → smart-core**      | ✅     | 2026-07-15 | `BrandingManager` di `@smart/core/company/branding.js`. Menyediakan logo, favicon, companyName, workspace, theme. |
| EPIC-001  | **Company Types → smart-core**        | ✅     | 2026-07-15 | `COMPANY_TYPES` + `getCompanyTypeOptions()` di `@smart/core`. 16 jenis: PT, CV, Perorangan, Firma, Yayasan, BUMDes, BUMDes Bersama, Koperasi, Pesantren, Sekolah, Pemerintah Desa, Kecamatan, OPD, Puskesmas, Rumah Sakit, Lainnya. |
| EPIC-001  | **Persistence → smart-data**          | ✅     | 2026-07-15 | `createStore()` dari Inventory pindah ke `@smart/data/persistence.js`. |
| EPIC-001  | **MongoDB Connection → smart-data**   | ✅     | 2026-07-15 | `dbConfig`, `createDbConfig()`, `checkConnection()`, `createApiRepository()` pindah ke `@smart/data/mongodb.js`. |
| EPIC-001  | **BaseRepository → smart-data**       | ✅     | 2026-07-15 | `BaseRepository` + `InMemoryRepository` pindah ke `@smart/data/base-repository.js`. |
| EPIC-001  | **API Fallback → smart-api**          | ✅     | 2026-07-15 | `buildQuery`, `normalizeItem`, `normalizeList`, `apiFetch`, `withFallback`, `apiListFallback`, `apiCreateFallback`, `apiUpdateFallback`, `apiDeleteFallback`, `apiGetFallback` pindah ke `@smart/api/fallback.js`. |
| EPIC-001  | **PageContainer → smart-ui**          | ✅     | 2026-07-15 | `PageContainer()` + `renderBreadcrumb()` pindah ke `@smart/ui/components/page-container/`. |
| EPIC-001  | **Settings Company → smart-ui module**| ✅     | 2026-07-15 | `SettingsCompanyModule` di `@smart/ui/modules/settings/company.js`. Menerima data services via DI. Inventory tinggal import dan inject. |
| EPIC-001  | **Enhanced Company Model**            | ✅     | 2026-07-15 | Server model Company diperluas: `tenantId`, `tenantCode`, `favicon`, `workspace`, `timezone`, `currency`, `language`, `theme`, `features`, `isActive`. |
| EPIC-001  | **tenantId on all models**            | ✅     | 2026-07-15 | `tenantId` ditambahkan ke model User, Role, Barang, Company, Permission. Seed data juga disertakan. |
| Inventory | Sprint 1 — Authentication             | ✅     | 2026-07-14 | Login page, logout, session, protected routes. Users: admin/admin123. |
| Inventory | Sprint 1 — Application Shell          | ✅     | 2026-07-14 | AppShell, Sidebar (nested groups), Topbar, Breadcrumb + PageContainer. |
| Inventory | Sprint 1 — Dashboard                  | ✅     | 2026-07-14 | Enhanced dashboard with stat cards, welcome banner.                   |
| Inventory | Sprint 1 — Database Layer             | ✅     | 2026-07-14 | MongoDB abstraction, BaseRepository + InMemoryRepository (kini dari framework). |
| Inventory | Barang CRUD                           | ✅     | 2026-07-14 | Full CRUD with SMART UI components. 12 seed items.                    |
| Inventory | Sprint 2 — Settings Company CRUD      | ✅     | 2026-07-14 | Full CRUD via framework `SettingsCompanyModule`. Company types: 16 jenis. |
| Inventory | Sprint 2 — Settings User CRUD         | ✅     | 2026-07-14 | Full CRUD with role assignment. Data services via settings-data.js.   |
| Inventory | Sprint 2 — Settings Role CRUD         | ✅     | 2026-07-14 | Full CRUD with level hierarchy. Data services via settings-data.js.   |
| Inventory | Sprint 2 — Settings Permission        | ✅     | 2026-07-14 | Role-permission matrix with expandable groups, checkbox toggle.       |
| Inventory | **Multi-Tenant Data Isolation**       | ✅     | 2026-07-14 | All entities scoped by companyCode. Company context on login, cleared on logout. |
| Inventory | Company Form — Rich Structure         | ✅     | 2026-07-14 | Form with Logo upload, Identitas, Data Legalitas, Struktur Organisasi sections. |
| Inventory | Supplier CRUD                         | ⬜     | —          | Placeholder only.                                                     |

## EPIC-001 Framework Refactor Summary (2026-07-15)

### Files Moved to Framework

| Framework Package | Files Created | Original Location |
|-------------------|---------------|-------------------|
| `@smart/core/company/company-context.js` | `CompanyManager` class + function API | `inventory/src/data/company-context.js` |
| `@smart/core/company/branding.js` | `BrandingManager` class | *New* |
| `@smart/core/company/company-types.js` | `COMPANY_TYPES` (16 jenis) | *New* |
| `@smart/data/persistence.js` | `createStore()` | `inventory/src/data/persistence.js` |
| `@smart/data/mongodb.js` | `dbConfig`, `checkConnection`, `createApiRepository` | `inventory/src/data/mongodb.js` |
| `@smart/data/base-repository.js` | `BaseRepository`, `InMemoryRepository` | `inventory/src/data/base-repository.js` |
| `@smart/api/fallback.js` | 10 API fallback utilities | `inventory/src/data/api.js` |
| `@smart/ui/components/page-container/` | `PageContainer`, `renderBreadcrumb` | `inventory/src/components/page-container.js` |
| `@smart/ui/modules/settings/company.js` | `SettingsCompanyModule` (DI-based) | `inventory/src/pages/settings/company/` |

### Inventory Re-exports (Backward Compatibility)
- `inventory/src/data/company-context.js` → re-exports from `@smart/core`
- `inventory/src/data/persistence.js` → re-exports from `@smart/data`
- `inventory/src/data/mongodb.js` → re-exports from `@smart/data`
- `inventory/src/data/base-repository.js` → re-exports from `@smart/data`
- `inventory/src/components/page-container.js` → re-exports from `@smart/ui`
- `inventory/src/pages/settings/company/index.js` → uses `SettingsCompanyModule` from `@smart/ui`

### Server Model Updates
- All models now include `tenantId` field
- Company model enhanced with: `tenantId`, `tenantCode`, `favicon`, `workspace`, `timezone`, `currency`, `language`, `theme`, `features`, `isActive`
- Seed data updated with `tenantId` on all collections

### Architecture Diagram
```
Framework                        Inventory (thin)
────────                        ────────────────
@smart/core                     apps/inventory
  ├── auth/                       ├── pages/
  ├── permission/                  │   ├── barang/ (inventory-specific)
  ├── institution/                 │   ├── dashboard/ (inventory-specific)
  ├── app/                         │   ├── settings/
  └── company/                     │   │   └── company/ → framework module
    ├── company-context.js          │   │   ├── user/
    ├── branding.js                 │   │   ├── role/
    └── company-types.js            │   │   └── permission/
                                    │   ├── supplier/ (placeholder)
@smart/data                         │   ├── login/
  ├── state.js                      │   └── pembelian/
  ├── cache.js                    ├── data/
  ├── pagination.js                 │   ├── barang-data.js (INVENTORY-SPECIFIC)
  ├── repository.js                 │   ├── settings-data.js (INVENTORY-SPECIFIC)
  ├── base-repository.js ← NEW      │   └── [framework re-exports]
  ├── persistence.js ← NEW        ├── config/
  └── mongodb.js ← NEW             └── router/

@smart/api                     apps/inventory/server
  ├── client.js                    ├── models/ (all with tenantId)
  ├── error.js                     ├── routes/
  ├── interceptors/                └── seed.js (with tenantId)
  └── fallback.js ← NEW

@smart/ui
  ├── components/
  │   └── page-container/ ← NEW
  ├── layouts/
  ├── modules/
  │   └── settings/
  │       └── company.js ← NEW
  └── tokens/
```

## Legend
- ⬜ Not Started
- 🔄 In Progress
- ✅ Completed
- ⏳ On Hold
