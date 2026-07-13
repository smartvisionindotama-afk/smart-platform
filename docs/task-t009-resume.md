# TASK T-009 — Copy app.js ke @smart/core
## Resume Hasil

**Sprint:** Sprint 2 — SMART Core Extraction
**Branch:** `epic-001`
**Status:** ✅ Selesai

---

## Tujuan

Memindahkan `app.js` dari `apps/inventory/src/core/app/app.js` ke `packages/smart-core/src/app/app.js`.

## File yang Dibuat

| File | Status |
|---|---|
| `packages/smart-core/src/app/app.js` | 🆕 Copied from Inventory |

## Detail

- **Config object:** `AppConfig`
- **Properties:** `name`, `version`, `company`, `environment`, `apiUrl`
- **Export:** `export default AppConfig`
- ✅ Isi identik dengan file asli di Inventory

## Verifikasi

| Check | Hasil |
|---|---|
| `npm install` (root) | ✅ 24 packages, 0 vulnerabilities |
| `npm run build` (Inventory) | ✅ Built in 170ms, 0 errors |
| Code Review | ✅ Clean copy, no issues |

## Catatan

- File asli di Inventory **belum dihapus**
- Hanya tinggal T-010 (barrel export) sebelum redirect imports di T-012
