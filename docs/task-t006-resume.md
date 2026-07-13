# TASK T-006 — Copy auth.js ke @smart/core
## Resume Hasil

**Sprint:** Sprint 2 — SMART Core Extraction
**Branch:** `epic-001`
**Status:** ✅ Selesai

---

## Tujuan

Memindahkan `auth.js` dari `apps/inventory/src/core/auth/auth.js` ke `packages/smart-core/src/auth/auth.js` sebagai langkah pertama ekstraksi SMART Core ke package independen.

## File yang Dibuat

| File | Status |
|---|---|
| `packages/smart-core/src/auth/auth.js` | 🆕 Copied from Inventory |

## Detail

- **Class:** `Auth` (singleton)
- **Methods:** `login()`, `logout()`, `isLoggedIn()`, `user()`
- **Users:** admin (owner), operator (operator)
- **Export:** `export default new Auth()`
- ✅ Isi identik dengan file asli di Inventory

## Verifikasi

| Check | Hasil |
|---|---|
| `npm install` (root) | ✅ 24 packages, 0 vulnerabilities |
| `npm run build` (Inventory) | ✅ Built in 182ms, 0 errors |

## Catatan

- File asli di `apps/inventory/src/core/auth/auth.js` **belum dihapus** — masih dipakai Inventory
- Import redirect akan dilakukan di T-012
- Tidak ada perubahan fungsional — hanya copy
