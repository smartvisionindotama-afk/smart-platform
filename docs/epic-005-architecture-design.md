# EPIC-005 — Developer Platform Foundation
## Architecture Design Document

**Date:** 2026-07-16  
**Status:** Draft — Ready for Review  
**Author:** SMART Framework Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Review](#2-architecture-review)
3. [Conflict Analysis](#3-conflict-analysis)
4. [Design Decisions](#4-design-decisions)
5. [Implementation Plan](#5-implementation-plan)
6. [Folder Structure](#6-folder-structure)
7. [Migration Plan](#7-migration-plan)
8. [Risk Analysis](#8-risk-analysis)
9. [Execution Checklist](#9-execution-checklist)

---

## 1. Executive Summary

### Current State

SMART Platform telah memiliki Enterprise SDK dengan Facade Architecture:

| SDK | Status | Entry Point |
|-----|--------|-------------|
| SMART.Session | ✅ Stable | `import { SMART } from "@smart/core"` |
| SMART.Company | ✅ Stable | `import { SMART } from "@smart/core"` |
| SMART.DB | ✅ Stable | `import { DB } from "@smart/data"` |
| SMART.API | ✅ Stable | `import { API } from "@smart/api"` |
| SMART.UI | ✅ Stable | `import { UI } from "@smart/ui"` |
| SMART.Permission | ✅ Stable | `import { SMART } from "@smart/core"` |
| SMART.Platform | ✅ Stable | `import { SMART } from "@smart/core"` |
| SMART.Audit | ✅ Stable | `import { SMART } from "@smart/core"` |
| SMART.Impersonation | ✅ Stable | `import { SMART } from "@smart/core"` |

### Target State

Menambahkan Developer Platform Foundation tanpa mengubah public API yang sudah stabil:

1. Event Bus
2. Dependency Injection Container
3. Plugin System
4. Lifecycle Hooks
5. Configuration Provider
6. CLI Architecture
7. Module Generator
8. Application Generator

---

## 2. Architecture Review

### 2.1 Current Architecture

```
Application (Inventory)
        │
        ▼
SMART Facade (facade.js)  ← import { SMART }
  ├── Import internal modules DIRECTLY
  ├── onInit: manual start() call
  ├── onChange: callback arrays
  └── Config: scattered (workspace.json, localStorage, window.*)
        │
        ▼
Internal SDK
  ├── Singletons (Auth, Permission, Company, Session)
  ├── onChange pattern (callback registration)
  └── No DI, no events, no plugins
```

### 2.2 Pattern Analysis

| Pattern | Current Implementation | Limitation |
|---------|----------------------|------------|
| **Event/Notification** | `onChange(callback)` — each module has its own | Tidak terpusat, tidak ada event payload standard, tidak ada async support |
| **Dependency Resolution** | Static `import` | Tidak bisa swap implementation, tight coupling |
| **Extensibility** | None — facade is static object | Tidak bisa tambah fitur tanpa edit source code |
| **Lifecycle** | Manual `start()` di main.js | Tidak ada hooks, tidak ada lifecycle state |
| **Configuration** | Scattered across modules | Tidak ada single source of truth, tidak ada validation |
| **Code Generation** | None | Setiap app baru harus copy-paste |

### 2.3 Key Conflicts Identified

#### Conflict 1: Event Bus vs Existing `onChange` Pattern

**Current:** Each module (Auth, Permission, Company, Branding, Session, Audit, Platform, Impersonation) has its own `onChange` callback registration. These are simple `push()` into arrays.

**Risk:** Adding Event Bus yang baru bisa membuat dual patterns — developer bingung harus pakai `SMART.Events.on()` atau `SMART.Session.onChange()`?

**Solution:**
- Bikin Event Bus sebagai **layer di atas** existing `onChange`
- Event Bus otomatis subscribe ke semua `onChange` modules dan re-emit sebagai event standar
- Existing `onChange` tetap berfungsi (backward compat)
- Event Bus menggunakan `SMART.Events` namespace

```js
// SMART.Events — Event Bus (NEW)
SMART.Events.on("session:changed", handler)
SMART.Events.on("company:changed", handler)
SMART.Events.on("auth:login", handler)
SMART.Events.on("auth:logout", handler)
SMART.Events.emit("custom:event", payload)
SMART.Events.once("app:ready", handler)

// Existing onChange tetap berfungsi
SMART.Session.onChange(handler)     // ✅ masih jalan
SMART.Company.onChange(handler)     // ✅ masih jalan
SMART.Events.on("session:changed")  // ✅ cara baru
```

#### Conflict 2: DI Container vs Hardcoded Imports

**Current:** `facade.js` langsung `import` internal modules:

```js
import { companyManager as _Company } from "./company/company-manager.js";
import { session as _Session } from "./session/index.js";
import Permission from "./permission/permission.js";
```

**Risk:** DI Container butuh mekanisme registrasi/resolusi yang tidak mengubah cara import saat ini.

**Solution:**
- DI Container adalah **optional** — facade tetap menggunakan import langsung
- DI Container bisa diakses via `SMART.Container` untuk aplikasi yang membutuhkan
- Internal modules bisa di-register ke container untuk testing/swapping
- Module generator otomatis register ke container

```js
// Cara baru (optional)
SMART.Container.register("BarangService", BarangService)
const svc = SMART.Container.resolve("BarangService")

// Cara lama tetap jalan
import { SMART } from "@smart/core" // ✅
```

#### Conflict 3: Plugin System vs Static Facade

**Current:** `SMART` object is a static `const SMART = { ... }` — tidak bisa di-extend.

**Risk:** Plugin perlu register method baru ke SMART namespace tanpa mengubah facade.js.

**Solution:**
- Tambah method `SMART.use()` dan `SMART.extend()` ke facade
- Plugin registration menyimpan references di Map internal, bukan di object literal
- Plugin bisa menambah namespace baru (misal `SMART.Reporting`)
- Plugin lifecycle hooks: `onInit`, `onReady`, `onDestroy`

```js
// Plugin registration
SMART.use(MyPlugin, options)
// atau
SMART.extend("Reporting", ReportingModule)

// Plugin mendefinisikan hooks
const plugin = {
  name: "my-plugin",
  onInit: (config) => { ... },
  onReady: (app) => { ... },
  onDestroy: () => { ... }
}
SMART.use(plugin)
```

#### Conflict 4: Lifecycle Hooks vs Manual start()

**Current:** `main.js` punya `start()` function yang manual memanggil:
```js
async function start() {
  loadUI()
  // ...login check...
  // ...render app...
}
```

**Solution:**
- Tambah `SMART.App` lifecycle manager
- Lifecycle state machine: `bootstrap → init → ready → running → destroy`
- Hooks: `onBeforeInit`, `onInit`, `onAfterInit`, `onReady`, `onDestroy`, `onError`
- Backward compat: `start()` tetap jalan, tapi bisa diganti dengan `SMART.App.start()`

```js
// Lifecycle hooks
SMART.App.onBeforeInit(() => console.log("starting..."))
SMART.App.onReady(() => console.log("app ready"))

// Init dengan auto lifecycle
await SMART.App.start({
  modules: [Auth, Session, Company],
  plugins: [MyPlugin]
})
```

#### Conflict 5: Configuration Provider vs Scattered Config

**Current:** Config tersebar di:
- `workspace.json` (workspace config)
- `window.API_BASE_URL` (API config)
- `localStorage` (theme, sidebar state)
- `menu.js` (navigation config)
- `AppConfig` (app metadata)
- Hardcoded constants

**Solution:**
- Config Provider dengan priority chain: ENV → localStorage → workspace.json → defaults
- Namespace-based config keys: `app.name`, `api.baseUrl`, `theme.mode`
- Validation schema per config namespace

```js
SMART.Config.get("app.name")        // "SMART Inventory"
SMART.Config.get("api.baseUrl")     // "http://localhost:3001"
SMART.Config.get("theme.mode")      // "light"
SMART.Config.set("theme.mode", "dark")
SMART.Config.onChange("theme.mode", handler)
```

#### No Conflict: CLI, Module Generator, App Generator

Feature ini **tidak ada conflict** dengan implementasi existing karena:
- CLI adalah external tool (node.js script)
- Generator output adalah file baru
- Tidak mengubah runtime behavior

---

## 3. Conflict Analysis Summary

| Feature | Conflict | Severity | Solution |
|---------|----------|----------|----------|
| Event Bus | `onChange` pattern existing | Medium | Wrapping layer, backward compat |
| DI Container | Hardcoded imports | Low | Optional — facade tetap langsung |
| Plugin System | Static facade object | Medium | `SMART.use()`, `SMART.extend()` |
| Lifecycle Hooks | Manual `start()` | Low | `SMART.App.start()` wrapping |
| Config Provider | Scattered config | Medium | Priority chain, namespace keys |
| CLI Architecture | None | None | New package |
| Module Generator | None | None | New package |
| App Generator | None | None | New package |

---

## 4. Design Decisions

### 4.1 Namespace Allocation

```
SMART.Events        — Event Bus (NEW)
SMART.Container      — DI Container (NEW)
SMART.use()          — Plugin registration (NEW)
SMART.extend()       — Namespace extension (NEW)
SMART.App            — Lifecycle Manager (NEW)
SMART.Config         — Configuration Provider (NEW)
```

Semua fitur baru masuk ke `SMART.*` namespace — konsisten dengan existing facade pattern.

### 4.2 Package Structure

```
packages/
  smart-core/        ← EXISTING — tambah Events, Container, Plugin, Lifecycle, Config
  smart-data/        ← EXISTING — no change
  smart-api/         ← EXISTING — no change
  smart-ui/          ← EXISTING — no change
  smart-cli/         ← NEW — CLI tools
  smart-generator/   ← NEW — Module & App generators (depends on smart-cli)
```

### 4.3 Dependency Direction

```
smart-generator → smart-cli → smart-core
                                    ↑
                              smart-api
                              smart-data
                              smart-ui
smart-core adalah ROOT — tidak boleh depend ke smart-cli atau smart-generator.
```

### 4.4 Backward Compatibility Rules

1. **Tidak ada** breaking change pada `SMART.*` public API yang sudah stable.
2. **Tidak ada** perubahan pada package exports yang sudah di-declare.
3. Existing `onChange` pattern **tetap berfungsi** — Event Bus hanya tambahan.
4. Existing `import { SMART } from "@smart/core"` **tetap sama**.
5. Semua fitur baru adalah **opsional** — aplikasi lama tidak perlu menggunakannya.
6. Deprecated API **tidak dihapus** — hanya ditandai.

---

## 5. Implementation Plan

### Phase 1: Foundation (Sprint 5)

**Deliverable:** Event Bus + Configuration Provider + Lifecycle Hooks

| Week | Feature | Files | Dependencies |
|------|---------|-------|--------------|
| 1 | Event Bus | `packages/smart-core/src/events/` | None |
| 1 | Config Provider | `packages/smart-core/src/config/` | None |
| 2 | Lifecycle Hooks | `packages/smart-core/src/app/` | Events |
| 2 | Unit tests | `__tests__/events.test.js`, `__tests__/config.test.js`, `__tests__/app.test.js` | Features |

### Phase 2: Extensibility (Sprint 6)

**Deliverable:** DI Container + Plugin System

| Week | Feature | Files | Dependencies |
|------|---------|-------|--------------|
| 3 | DI Container | `packages/smart-core/src/container/` | Config |
| 3 | Plugin System | `packages/smart-core/src/plugin/` | Events, Container |
| 4 | Integration tests | Plugin integration with existing modules | Phase 1 |

### Phase 3: Developer Tools (Sprint 7)

**Deliverable:** CLI + Generators

| Week | Feature | Files | Dependencies |
|------|---------|-------|--------------|
| 5 | CLI Architecture | `packages/smart-cli/` | None |
| 5 | Module Generator | `packages/smart-generator/src/module/` | CLI |
| 6 | App Generator | `packages/smart-generator/src/app/` | Module |
| 6 | Documentation | Docs + examples | All |

### Phase 4: Migration (Sprint 7-8)

**Deliverable:** Inventory + Docs updated

| Week | Task | Files |
|------|------|-------|
| 7 | Update Inventory main.js | `apps/inventory/src/main.js` |
| 7 | Add lifecycle hooks | `packages/smart-core/src/context/` |
| 8 | Documentation sprint | All docs |

---

## 6. Folder Structure

### 6.1 smart-core — New Modules

```diff
 packages/smart-core/src/
   index.js                    ← UPDATE — tambah export Events, Config, App, Container, Plugin
   facade.js                   ← UPDATE — tambah SMART.Events, SMART.Config, SMART.App, dll
+  events/
+    index.js                  ← EventBus class
+    event-bus.js              ← Implementation (on, off, emit, once, pipe)
+  config/
+    index.js                  ← ConfigProvider class
+    config-loader.js          ← Load from env, localStorage, workspace, defaults
+    config-schema.js          ← Validation schemas per namespace
+  container/
+    index.js                  ← DIContainer class
+    resolver.js               ← Dependency resolution (singleton, factory, instance)
+  plugin/
+    index.js                  ← PluginManager class
+    plugin-registry.js        ← Plugin registration & lifecycle
+    hooks.js                  ← Hook definitions
+  app/
+    index.js                  ← AppLifecycle class
+    lifecycle.js              ← State machine: bootstrap → init → ready → running → destroy
   ...existing folders tetap sama...
```

### 6.2 New Packages

```
 packages/
+  smart-cli/
+    package.json
+    src/
+      index.js               ← CLI entry point
+      commands/
+        init.js               ← init project
+        generate.js           ← generate module/app
+        build.js              ← build app
+        dev.js                ← dev server
+  smart-generator/
+    package.json
+    src/
+      index.js               ← Generator entry
+      module/
+        index.js              ← Module generator
+        templates/            ← Module templates
+      app/
+        index.js              ← App generator
+        templates/            ← App templates
```

---

## 7. Migration Plan

### Existing Applications (Inventory)

**No migration needed** untuk aplikasi yang sudah ada. Semua fitur baru adalah optional.

**Recommended updates** (opsional):
```js
// main.js — SEBELUM
import { SMART } from "@smart/core"
loadUI()
// ... manual startup logic ...

// main.js — SESUDAH (optional enhancement)
import { SMART } from "@smart/core"
SMART.App.start({
  modules: { Auth, Session, Company, Permission },
  config: { app: "inventory", version: "1.0" }
})
```

### Breaking Change Risk

| Feature | Breaking? | Mitigation |
|---------|-----------|------------|
| Event Bus | No — add only | Wrapper di atas onChange |
| Config Provider | No — add only | Tidak override window.* atau localStorage |
| DI Container | No — optional | Tidak ubah facade imports |
| Plugin System | No — optional | `SMART.use()` — tidak otomatis |
| Lifecycle Hooks | No — optional | Existing start() tetap jalan |
| CLI | No — new package | Tidak terinstall otomatis |
| Generators | No — new package | Tidak terinstall otomatis |

---

## 8. Risk Analysis

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Event Bus duplicate events | Medium | Medium | Debounce, deduplication |
| Plugin system performance | Low | Medium | Lazy loading plugin |
| Config namespace collision | Low | High | Namespace prefix validation |
| DI Container overengineering | Medium | Low | Keep it simple — register/resolve only |
| CLI dependency conflicts | Low | Medium | Minimal dependencies |
| Generator template maintenance | Medium | Low | Separate templates from code |
| Scope creep (adding features) | High | High | Strict scope control — JANGAN nambah fitur baru |

### Critical Risk: Event Bus Duplication

**Problem:** Setiap module punya `onChange`. Event Bus subscribe ke semua `onChange` dan re-emit. Ini bisa menyebabkan event terduplikasi jika module emits multiple times.

**Solution:**
```js
// Event Bus menggunakan debounce per event type
const pending = new Map()
function emit(type, payload) {
  if (pending.has(type)) return // skip if already queued
  pending.set(type, payload)
  Promise.resolve().then(() => {
    const p = pending.get(type)
    pending.delete(type)
    // emit to all listeners
  })
}
```

---

## 9. Execution Checklist

### Sprint 5 — Foundation
- [ ] Create `packages/smart-core/src/events/`
- [ ] EventBus: `on`, `off`, `emit`, `once`
- [ ] EventBus: auto-subscribe to existing `onChange` modules
- [ ] Create `packages/smart-core/src/config/`
- [ ] ConfigProvider: priority chain (env → localStorage → workspace → defaults)
- [ ] ConfigProvider: namespace validation
- [ ] Create `packages/smart-core/src/app/`
- [ ] Lifecycle: state machine (bootstrap → init → ready → running → destroy)
- [ ] Lifecycle: hooks (onBeforeInit, onInit, onAfterInit, onReady, onDestroy, onError)
- [ ] Update facade.js — add SMART.Events, SMART.Config, SMART.App
- [ ] Update smart-core/index.js — export new modules (marked as @internal)
- [ ] Write tests: events.test.js, config.test.js, app.test.js
- [ ] Run all 508+ tests — must pass

### Sprint 6 — Extensibility
- [ ] Create `packages/smart-core/src/container/`
- [ ] DIContainer: `register`, `resolve`, `singleton`, `factory`
- [ ] Create `packages/smart-core/src/plugin/`
- [ ] PluginManager: `use`, `extend`, lifecycle hooks
- [ ] Plugin registration: `SMART.use(plugin)`, `SMART.extend(name, module)`
- [ ] Update facade.js — add SMART.Container, SMART.use, SMART.extend
- [ ] Write integration tests
- [ ] Run all tests — must pass

### Sprint 7 — Developer Tools
- [ ] Scaffold `packages/smart-cli/`
- [ ] CLI: `init`, `generate`, `build`, `dev` commands
- [ ] Scaffold `packages/smart-generator/`
- [ ] Module Generator: CRUD module from template
- [ ] App Generator: Full app from template
- [ ] Write CLI tests

### Sprint 8 — Migration & Docs
- [ ] Update Inventory main.js (optional)
- [ ] Update docs/execution_status.md
- [ ] Update docs/EPIC-005-completion-report.md
- [ ] Create migration guide for existing apps
- [ ] Create developer quickstart guide
- [ ] Final architecture review

---

## Appendix A: Public API Reference (New)

```js
// Event Bus
SMART.Events.on(event, handler)          // Subscribe
SMART.Events.off(event, handler)         // Unsubscribe
SMART.Events.emit(event, payload)        // Emit event
SMART.Events.once(event, handler)        // Subscribe once

// Configuration
SMART.Config.get(key)                    // Get config value
SMART.Config.get(key, default)           // With default
SMART.Config.set(key, value)             // Set config value
SMART.Config.all()                        // Get all config
SMART.Config.onChange(key, handler)      // Subscribe to config changes
SMART.Config.load(source)                // Load config from source

// Lifecycle
SMART.App.start(opts)                    // Start application
SMART.App.state()                         // Get lifecycle state
SMART.App.onBeforeInit(handler)           // Hook
SMART.App.onInit(handler)                 // Hook
SMART.App.onAfterInit(handler)            // Hook
SMART.App.onReady(handler)                // Hook
SMART.App.onDestroy(handler)              // Hook
SMART.App.onError(handler)                // Error hook

// DI Container
SMART.Container.register(name, impl)     // Register service
SMART.Container.resolve(name)            // Resolve service
SMART.Container.singleton(name, impl)    // Register singleton

// Plugin System
SMART.use(plugin)                         // Register plugin
SMART.extend(namespace, module)           // Extend SMART namespace
```

## Appendix B: Existing Public API (Unchanged)

Semua existing API tetap — tidak ada perubahan:

```js
SMART.Session                           // ✅ unchanged
SMART.Company                           // ✅ unchanged
SMART.DB                                // ✅ unchanged
SMART.API                               // ✅ unchanged
SMART.Permission                        // ✅ unchanged
SMART.Platform                          // ✅ unchanged
SMART.Audit                             // ✅ unchanged
SMART.Impersonation                     // ✅ unchanged
SMART.UI                                // ✅ unchanged (via globalThis)
```

---

*End of Architecture Design Document*
