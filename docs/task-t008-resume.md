# TASK T-008 — Copy permission.js ke @smart/core
## Resume Hasil

**Sprint:** Sprint 2 — SMART Core Extraction
**Branch:** `epic-001`
**Status:** ✅ Selesai

---

## Tujuan

Memindahkan `permission.js` dari `apps/inventory/src/core/permission/permission.js` ke `packages/smart-core/src/permission/permission.js`.

## File yang Dibuat

| File | Status |
|---|---|
| `packages/smart-core/src/permission/permission.js` | 🆕 Copied from Inventory |

## Detail

- **Import:** `Auth` dari `../auth/auth.js` (resolves ke package, bukan Inventory)
- **Roles:** owner (11 permissions), manager (8), operator (3)
- **Class:** `Permission` (singleton)
- **Methods:** `currentRole()`, `can()`, `setRole()`, `menu()`
- **Export:** `export default new Permission()`

## Verifikasi

| Check | Hasil |
|---|---|
| `npm install` (root) | ✅ 24 packages, 0 vulnerabilities |
| `npm run build` (Inventory) | ✅ Built in 201ms, 0 errors |
| Code Review | ✅ Import path correct, no issues |

## Catatan

- Import `../auth/auth.js` resolve dengan benar karena `auth.js` sudah ada di package dari T-006
- File asli di Inventory **belum dihapus**
