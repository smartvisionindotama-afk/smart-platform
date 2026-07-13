# TASK T-012 — Redirect imports ke @smart/core
## Resume Hasil

**Sprint:** Sprint 2 — SMART Core Extraction
**Branch:** `epic-001`
**Status:** ✅ Selesai

---

## Tujuan

Mengubah import di Inventory dari relative path `src/core/` ke package `@smart/core` melalui monorepo workspaces.

## File yang Diubah

| File | Perubahan |
|---|---|
| `apps/inventory/src/core/app/bootstrap.js` | 🔄 Import `{ AppConfig, Institution, Permission, Auth }` dari `@smart/core` |
| `apps/inventory/src/router/index.js` | 🔄 Import `{ Permission }` dari `@smart/core` |
| `apps/inventory/src/components/sidebar/Sidebar.js` | 🔄 Import `{ Permission }` dari `@smart/core` |

## Detail Perubahan

**Sebelum:**
```js
import Auth from "../auth/auth.js";
import { routes } from "./routes";
import Permission from "../../core/permission/permission";
```

**Sesudah:**
```js
import { Auth, Permission, Institution, AppConfig } from "@smart/core";
import { routes } from "./routes";
```

- ✅ `loadWorkspace` tetap import lokal (`../workspace/workspace.js`) — karena workspace loader tidak ada di `@smart/core`
- ✅ Named exports sesuai dengan barrel export `index.js`

## Verifikasi

| Check | Hasil |
|---|---|
| `npm install` (root) | ✅ 24 packages, 0 vulnerabilities |
| `npm run build` (Inventory) | ✅ **28 modules** (sebelumnya 27), built in 253ms, 0 errors |
| Code Review | ✅ Import paths correct, no issues |

## Catatan

- **Pertama kalinya** Inventory resolve import dari `@smart/core` — build sukses ✅
- File asli di `src/core/` **belum dihapus** — akan dilakukan di T-028
- `bootstrap.js` masih di `src/core/app/` — akan dipindahkan saat cleanup
