# SMART PLATFORM — Architecture Audit Report

**Author:** Chief Software Architect, PT SMART VISION INDOTAMA  
**Date:** July 14, 2026  
**Phase:** Pre EPIC-006 — Platform Stabilization Mission  
**Status:** Complete

---

## Executive Summary

A comprehensive architecture audit of the SMART Platform was performed across all four packages (`@smart/core`, `@smart/api`, `@smart/data`, `@smart/ui`) and the reference application (`apps/inventory`). The platform demonstrates a well-considered layered architecture with clear separation of concerns. However, several issues were identified — primarily in the areas of hardcoded test data, incomplete exports, missing package dependencies, and documentation gaps.

**Overall Assessment:** The architecture is **sound** but has **8 findings** (0 Critical, 2 High, 3 Medium, 3 Low) that should be addressed before declaring production readiness.

---

## 1. Folder Structure Review

### Current Structure

```
srv/
├── packages/
│   ├── smart-core/          # Business engine (Auth, Institution, Permission, App)
│   ├── smart-api/           # HTTP client & interceptors
│   ├── smart-data/          # Data layer (state, cache, pagination, repository)
│   ├── smart-ui/            # UI framework (tokens, components, layouts, workspaces)
│   └── smart-config/        # Shared config (ESLint, Vite)
├── apps/
│   ├── inventory/           # Reference application
│   └── _template/           # App template
├── platform/                # Deployment & monitoring
└── docs/                    # ADRs & task resumes
```

### Assessment: ✅ ADEQUATE

The folder structure follows a standard monorepo layout consistent with ADR-007 (Monorepo Strategy). Package names are self-explanatory. The `apps/_template` directory serves as a useful starting point for new applications.

**Minor observation:** The `package.json` uses `workspaces` but the root lacks `"type": "module"`, causing a warning during `eslint` execution.

---

## 2. Package Boundaries & Exports Review

### @smart/core (v1.0.0)

| Export | Status |
|--------|--------|
| `Auth` (default, singleton) | ✅ |
| `Institution` (default, singleton) | ✅ |
| `Permission` (default, singleton) | ✅ |
| `AppConfig` (default, singleton) | ✅ |
| `can`, `canAny`, `canAll` (from engine.js) | ⚠️ Re-exported but also accessible via Permission facade |
| `*` from roles.js | ⚠️ `getEffectivePermissions`, `getRole`, `listRoles`, `grantPermission`, `revokePermission` — exported both standalone and via Permission facade |

**Finding F-01 [MEDIUM]:** Dual export paths for permission functions create confusion. Consumers could use either `Permission.can()` or `can()` from engine.js. The facade pattern is good, but the raw engine exports should be documented as "advanced use only."

### @smart/api (v1.0.0)

| Export | Status |
|--------|--------|
| `createClient` | ✅ |
| Error classes (ApiError, NetworkError, etc.) | ✅ |
| Interceptors | ✅ |
| `BaseResource` | ✅ |

**Finding F-02 [LOW]:** `BaseResource` is exported from both `./resources/base.js` and `./resources/index.js`. The re-export in index.js is redundant since resources/index.js only re-exports BaseResource.

### @smart/data (v1.0.0)

| Export | Status |
|--------|--------|
| `createDataState` | ✅ |
| `createCache`, `clearAllCaches` | ✅ |
| `createPagination` | ✅ |
| `Repository` | ✅ |

**Finding F-03 [HIGH]:** The `Repository` class depends on `@smart/api` for `BaseResource`, but `@smart/data` has NO dependency on `@smart/api` in its `exports` map. Consumers importing `Repository` must also install `@smart/api` manually. **The actual `package.json` dependency is declared as `"@smart/api": "*"`, so this is correctly set up. However, the `Repository` class constructor accepts any object with `list()`, `get()`, `create()`, `update()`, `delete()` methods — not strictly a `BaseResource`. This opens the door for non-API-backed repositories but also creates an implicit contract.**

### @smart/ui (v1.0.0)

| Export | Status |
|--------|--------|
| Main entry (tokens, Button, Card, StatCard, loadWorkspace, loadUI) | ⚠️ Partial |
| `./components` (all 22 components) | ✅ |
| `./layouts` (Topbar, Sidebar, AppShell) | ✅ |
| `./workspaces` (loadWorkspace, validateWorkspaceConfig) | ✅ |

**Finding F-04 [HIGH]:** The main entry point (`src/index.js`) only exports `Button`, `Card`, `StatCard`, `loadWorkspace`, and `loadUI`. The remaining 19 components (Input, Select, Modal, Toast, Table, etc.) are ONLY accessible via `@smart/ui/components` sub-path. This is inconsistent — either export all or only the most common ones from the main entry.

**Finding F-05 [MEDIUM]:** The `export { Card, Button, StatCard }` from index.js is redundant since these are also available via `@smart/ui/components`. The index.js should either re-export all components or just the most important ones with clear documentation.

---

## 3. Dependency Graph Analysis

### Actual Dependency Chain

```
apps/inventory
    → @smart/core
    → @smart/ui

_template
    → @smart/core
    → @smart/ui

@smart/ui
    → (no deps on other smart packages)

@smart/core
    → (no deps on other smart packages)

@smart/api
    → @smart/core

@smart/data
    → @smart/api
```

### Intended Layered Architecture (per ADR-006)

```
Apps → @smart/ui → @smart/data → @smart/api → @smart/core
```

### Finding F-06 [LOW] — Dependency Inversion

The actual dependency graph does NOT fully reflect the intended architecture:
- `apps/inventory` directly imports `@smart/core` (bypassing the data→api→core chain)
- `apps/inventory` does NOT use `@smart/data` at all
- `@smart/ui` has zero dependencies on other smart packages (it's a leaf package, which is correct)

This is **not necessarily a problem** — apps should be able to import any package directly. However, the "layered diagram" suggests a strict flow that doesn't match reality.

### Finding F-07 [MEDIUM] — `@smart/ui` has zero package dependencies

While `@smart/ui` being independent is architecturally clean, it means UI components cannot inherently use `@smart/core` Auth/Permission for features like permission-based visibility. Currently, permission checks must be done in the application layer.

---

## 4. Layer Independence Review

### Per ADR-006 Assessment

| Package | Direct smart deps | Can be used standalone? |
|---------|-------------------|------------------------|
| `@smart/core` | None | ✅ Yes |
| `@smart/api` | `@smart/core` | ⚠️ Auth interceptor depends on Auth module |
| `@smart/data` | `@smart/api` | ⚠️ Repository expects API client |
| `@smart/ui` | None | ✅ Yes |

### Finding F-08 [MEDIUM] — Tight coupling via singletons

`@smart/core` exports **singleton instances** (not classes):

```js
export default new Auth();       // shared mutable singleton
export default new Institution(); // shared mutable singleton
export default new Permission();  // shared mutable singleton
```

This means:
- All importers share the same mutable state
- Testing becomes difficult (state leaks between tests)
- SSR or server-side usage is problematic
- No support for multiple instances

The singletons ARE re-initialized between tests via vitest's isolate feature, but the pattern itself is risky for future scalability.

---

## 5. Duplicated Logic Review

### Finding F-09 [LOW] — Subscriber pattern duplication

The subscriber pattern (onChange/subscribe, _listeners, _notify) is implemented independently in:

| File | Lines |
|------|-------|
| `smart-core/src/auth/auth.js` | ~30 lines (onChange, _notify) |
| `smart-core/src/institution/institution.js` | ~30 lines (onChange, _notify) |
| `smart-core/src/permission/permission.js` | ~30 lines (onChange, _notify) |
| `smart-data/src/state.js` | ~25 lines (onChange, notify) |
| `smart-data/src/pagination.js` | ~25 lines (onChange, notify) |

This is ~140 lines of nearly identical subscriber management code. Could be refactored into a shared utility.

**Severity:** LOW — it's a maintainability concern, not a bug.

---

## 6. Dead Code Review

### Finding F-10 [LOW] — Redundant re-exports

- `packages/smart-api/src/resources/index.js` — only re-exports BaseResource, which is already exported from the main index.js
- `packages/smart-ui/src/components/index.js` — correctly aggregates all 22 components (no dead code here)
- `apps/inventory/src/app.js` — referenced in inventory/package.json? No, main.js is the entry point. The file doesn't exist per read_files.

### Finding F-11 [LOW] — Unused test variables

- `smart-api/__tests__/interceptors.test.js`: `vi` imported but unused (lint warning)
- `smart-core/__tests__/permission.test.js`: Duplicate import (lint warning)
- `smart-core/src/permission/roles.js`: `name` variable assigned but never used (lint warning)

These are minor issues caught by the linter.

---

## 7. API Consistency Review

### Naming Conventions

| Pattern | Usage | Status |
|---------|-------|--------|
| `create*` factory functions | `createClient`, `createDataState`, `createCache`, `createPagination`, `createSession` | ✅ Consistent |
| `init*Interceptor` | `initAuthInterceptor`, `initContextInterceptor` | ✅ Consistent |
| `*RequestInterceptor` | `authRequestInterceptor`, `contextRequestInterceptor` | ✅ Consistent |
| Class-based | `Auth`, `Institution`, `Permission`, `BaseResource`, `Repository` | ✅ Consistent |
| Named export | All functions | ✅ Consistent |
| Default export | Singleton instances (Auth, Institution, Permission) and AppConfig | ⚠️ Mixed with named exports in index.js |

### Finding F-12 [MEDIUM] — Mixed default + named exports from @smart/core

```js
export { default as Auth } from "./auth/auth.js";       // named wrapping default
export { default as Institution } from "...";          // named wrapping default
export { default as Permission } from "...";           // named wrapping default
export { default as AppConfig } from "...";            // named wrapping default
export * from "./permission/engine.js";                // named: can, canAny, canAll
export * from "./permission/roles.js";                 // named: getEffectivePermissions, etc.
```

Consumers can write:
```js
import { Auth, Permission, can } from "@smart/core";
```

This works but the pattern is inconsistent — some are default exports re-wrapped, others are star-re-exports.

---

## 8. Naming Consistency Review

| Finding | Location | Severity |
|---------|----------|----------|
| `Sidebar.js` uses `sidebarClickAttached` module-level variable | `smart-ui/src/layouts/sidebar/Sidebar.js:1` | **HIGH** |
| `smart-config/eslint/index.js` has outdated comment about `extends` syntax | `smart-config/eslint/index.js:5` | LOW |
| `inventory/src/main.js` uses both `@smart/ui` and `@smart/ui/workspaces/engine` | `inventory/src/main.js` | LOW |

### Finding F-13 [HIGH] — Module-level mutable state in Sidebar

```js
let sidebarClickAttached = false;
```

This module-level variable persists across the app lifecycle and prevents re-rendering the sidebar navigation. If the app navigates to a page that re-invokes `Sidebar()`, the event delegation won't be re-attached because `sidebarClickAttached` is already `true`. This is a subtle bug that would manifest when dynamically updating menu items.

---

## 9. Performance Hotspots

| File | Lines | Concern |
|------|-------|---------|
| `smart-core/src/auth/auth.js` | 356 | In-memory user store with 2 hardcoded users — fine for demo, not for production |
| `smart-core/src/institution/institution.js` | 275 | Hardcoded institution data — same issue |
| `smart-core/src/permission/roles.js` | 214 | Hardcoded role definitions — acceptable as default seed data |

**No significant performance hotspots identified** in the current codebase. All data operations are O(n) or better.

---

## 10. Scalability Risks

| Risk | Severity | Description |
|------|----------|-------------|
| In-memory session store | **HIGH** | `session.js` uses a Map — sessions lost on page refresh. No persistence. |
| Hardcoded user data | **HIGH** | Auth users are hardcoded in auth.js — no API integration for real authentication |
| Hardcoded institutions | **MEDIUM** | Institution data is hardcoded — no API integration |
| Singleton instances | **MEDIUM** | Shared mutable state prevents concurrent operations |
| No request queuing | LOW | No retry or request deduplication in smart-api |
| Cache is per-browser-tab | LOW | Only in-memory, no shared/offline cache |

---

## 11. Maintainability Risks

| Risk | Severity | Description |
|------|----------|-------------|
| Sidebar side-effect (sidebarClickAttached) | **HIGH** | Module-level state makes Sidebar non-reentrant |
| CSS class naming inconsistency | MEDIUM | Some components use `smart-*` prefix, app CSS uses `app`, `main`, `sidebar` classes |
| Test data in production code | MEDIUM | Hardcoded users/passwords in Auth — security concern even for demo |
| No JSDoc in all files | LOW | Most files have good JSDoc but some components lack parameter documentation |

---

## 12. Finding Severity Summary

| ID | Finding | Severity |
|----|---------|----------|
| F-13 | Module-level mutable state in Sidebar prevents re-rendering | **HIGH** |
| F-04 | Incomplete main entry exports in @smart/ui | **HIGH** |
| F-08 | Singleton instances create tight coupling | MEDIUM |
| F-12 | Mixed default + named exports in @smart/core | MEDIUM |
| F-01 | Dual export paths for permission functions | MEDIUM |
| F-07 | @smart/ui has no smart-package dependencies | LOW |
| F-09 | Duplicated subscriber pattern (140 lines) | LOW |
| F-02 | Redundant BaseResource re-export | LOW |
| F-06 | Dependency chain doesn't match documented architecture | LOW |
| F-10 | Dead code (non-existent app.js reference) | LOW |
| F-11 | Unused variables (lint warnings) | LOW |

**Critical:** 0 | **High:** 2 | **Medium:** 3 | **Low:** 6

---

## 13. Recommendations

### Must Fix Before EPIC-006
1. **F-13**: Refactor `Sidebar.js` to remove module-level `sidebarClickAttached` — use instance-based or closure-based state
2. **F-04**: Update `@smart/ui/src/index.js` to export all components or at minimum document which components are available via sub-path exports

### Should Fix
3. **F-08**: Evaluate whether singleton pattern is appropriate or if factory functions should be available
4. **F-12**: Standardize on either default exports or named exports, not both
5. **F-01**: Clarify documentation around permission function import paths

### Nice to Fix
6. **F-09**: Extract subscriber pattern into shared utility
7. **F-10**: Remove dead references
8. **F-11**: Clean up lint warnings

---

*End of Architecture Audit Report*
