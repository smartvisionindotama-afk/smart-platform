# SMART PLATFORM — Framework Usability Review

**Author:** Chief Software Architect, PT SMART VISION INDOTAMA  
**Date:** July 14, 2026  
**Phase:** Pre EPIC-006 — Platform Stabilization Mission  
**Status:** Complete

---

## Scenario

> _"I am a new developer joining PT SMART VISION INDOTAMA. I have been asked to build a new SMART application using the framework. Can I do it using only the current documentation?"_

---

## 1. Documentation Inventory

### What exists:

| Document | Type | Quality |
|----------|------|---------|
| `docs/adr/ADR-001` through `ADR-011` | Architecture Decision Records | ✅ Good — explains WHY decisions were made |
| `docs/implementation-planning.md` | Planning doc | ✅ Good — high-level roadmap |
| `docs/smart-ui-component-architecture.md` | Component guide | ⚠️ Partial — covers component patterns but not all |
| `docs/smart-ui-component-dev-guide.md` | Developer guide | ⚠️ Partial |
| Various `task-*-resume.md` files | Task summaries | ❌ Not useful for new developers |
| `apps/_template/` | App template | ✅ Good starting point |
| `platform/docs/architecture/*.md` | Platform ops docs | ❌ Not about framework usage |

### What is MISSING:

#### ❌ Critical Gaps

| Missing Document | Impact |
|------------------|--------|
| **GETTING_STARTED.md** | No single "how to build your first app" guide |
| **API Reference** for @smart/core | No documentation of Auth, Institution, Permission, AppConfig APIs |
| **API Reference** for @smart/ui | No documentation of component props, slots, events |
| **API Reference** for @smart/data | No documentation of Repository, cache, pagination, state |
| **API Reference** for @smart/api | No documentation of client, interceptors, error handling |
| **Contributing Guide** | How to add new components or packages |

#### ❌ Missing Integration Guides

| Guide | Impact |
|-------|--------|
| Auth + API integration | How to wire Auth with API interceptors |
| Permission-based UI rendering | How to show/hide UI elements based on permissions |
| Workspace customization | How to create a new workspace for a client |
| Routing + Permission | How to add permission-protected routes |
| Data fetching with Repository | How to connect UI to data layer |

---

## 2. Confusing APIs

### Issue 1: Multiple import paths for @smart/ui

A developer sees:

```js
import { Button } from "@smart/ui";
import { Input } from "@smart/ui/components";
```

Why is `Button` available from `@smart/ui` but `Input` is not? The `package.json` `exports` map defines sub-path exports, but the main entry only exports 3 components.

**Verdict:** ❌ Confusing — leads to guesswork about import paths.

### Issue 2: Singleton instances vs classes

```js
import { Auth, Permission, AppConfig } from "@smart/core";

Auth.login("admin");                  // singleton — mutates global state
const allowed = Permission.can("x");  // depends on Auth internally
```

A new developer must understand that:
- `Auth` is a singleton instance (not a class)
- `Permission` reads `Auth.user()` internally
- This implicit coupling is not documented

**Verdict:** ⚠️ Not intuitive — implicit coupling should be documented.

### Issue 3: loadWorkspace vs loadUI

```js
import { loadUI, loadWorkspace } from "@smart/ui";

loadUI();                    // just console.logs "SMART UI Loaded"
await loadWorkspace(name);   // actually loads CSS + validates config
```

`loadUI()` seems like it should do more. Its current implementation is essentially a no-op.

**Verdict:** ⚠️ Misleading — `loadUI()` should either do something meaningful or be deprecated.

### Issue 4: Error handling inconsistency

```js
import { ApiError, NetworkError } from "@smart/api";

// But errors are thrown, not returned
try {
    const result = await client.get("/data");
} catch (error) {
    // error could be ApiError, NetworkError, or native Error
    if (error instanceof NetworkError) { ... }
}
```

The error classes are well-designed but their usage is not documented anywhere.

**Verdict:** ⚠️ Errors are defined but undocumented for consumers.

---

## 3. Difficult Setup

### Current setup process:

```
git clone <repo>
npm install
npm run dev --workspace=inventory
```

### Issues:

1. **No `npm run dev` at root** — developer must know to use `--workspace=inventory`
2. **No `npm run dev --workspace=_template`** — the template app has no Vite config that references shared config from `@smart/config/vite`
3. **Vite config duplication** — each app must configure Vite independently rather than extending the shared config

### Finding FU-01 [MEDIUM] — No root-level dev script

```json
// package.json scripts
"dev:inventory": "npm run dev --workspace=inventory",
"dev:template": "npm run dev --workspace=_template",
```

These are missing. Developer must know to manually use `--workspace` flags.

### Finding FU-02 [LOW] — Template uses vanilla Vite config

```js
// apps/_template/vite.config.js
export default defineConfig({
    server: { port: 3000 },
    build: { target: "es2020" },
});
```

This duplicates settings from `@smart/config/vite` instead of extending it.

---

## 4. Onboarding Issues

### Time to First Component

For a new developer to create their first page:

1. Understand workspace structure ✅ (intuitive)
2. Find the app template ✅
3. Understand `@smart/core` singletons ❌ (not documented)
4. Know which import paths to use ❌ (multiple patterns)
5. Know how to add routes ❌ (not documented)
6. Know how to use the data layer ❌ (Repository usage not documented)
7. Know how to test ❌ (no testing guide)

### Missing Developer Experience

| Need | Status |
|------|--------|
| Quick start guide | ❌ Missing |
| Component playground | ✅ (ui-test.js in inventory) |
| Code examples | ❌ Missing |
| Troubleshooting guide | ❌ Missing |
| Migration guide | ❌ Missing |

---

## 5. Recommendations for Documentation

### Must Have
1. **GETTING_STARTED.md** — Step-by-step guide to create a new SMART app
2. **API Reference** for all 4 packages (auto-generated or manual)
3. **Component Catalog** — Visual reference for all 22 UI components with props/examples

### Should Have
4. **Integration Patterns** — How to wire Auth + API + Data + UI
5. **Workspace Customization Guide** — How to create themed workspaces
6. **Testing Guide** — How to write tests for SMART components

### Nice to Have
7. **Contributing Guide**
8. **Architecture Overview Diagram** (visual)

---

## 6. Verdict

> **Can a new developer build a SMART application using only the current documentation?**

### Answer: ⚠️ Partially — with significant friction

The **template app** (`apps/_template`) provides a workable starting point, and the **component tests** serve as de-facto documentation for the UI library. However:

- There is NO getting-started guide
- There is NO API documentation for any package
- Import paths are inconsistent (@smart/ui vs @smart/ui/components)
- The data layer (@smart/data) has ZERO usage examples in any application
- `@smart/api` has ZERO usage in the inventory app

A determined developer could piece together the framework by reading source code and tests, but this is **not acceptable** for a production framework claiming to be the foundation for all company applications.

---

*End of Framework Usability Review*
