# TASK T-007 — Copy institution.js ke @smart/core
## Resume Hasil

**Sprint:** Sprint 2 — SMART Core Extraction
**Branch:** `epic-001`
**Status:** ✅ Selesai

---

## Tujuan

Memindahkan `institution.js` dari `apps/inventory/src/core/institution/institution.js` ke `packages/smart-core/src/institution/institution.js`.

## File yang Dibuat

| File | Status |
|---|---|
| `packages/smart-core/src/institution/institution.js` | 🆕 Copied from Inventory |

## Detail

- **Class:** `Institution` (singleton)
- **Methods:** `current()`, `set(name)`
- **Institutions:** inventory (warehouse), company (corporate), default
- **Export:** `export default new Institution()`
- ✅ Isi identik dengan file asli di Inventory

## Verifikasi

| Check | Hasil |
|---|---|
| `npm install` (root) | ✅ 24 packages, 0 vulnerabilities |
| `npm run build` (Inventory) | ✅ Built in 177ms, 0 errors |
| Code Review | ✅ Clean copy, no issues |

## Catatan

- File asli di Inventory **belum dihapus** — masih dipakai
- Import redirect akan dilakukan di T-012
