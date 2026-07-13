# TASK T-004 — Shared Config (ESLint + Vite)
## Resume Hasil

**Sprint:** Sprint 1 — Monorepo Foundation
**Branch:** `epic-001`
**Status:** ✅ Selesai

---

## Tujuan

Membuat `packages/smart-config/` dengan shared ESLint flat config dan shared Vite base config agar seluruh aplikasi SMART punya konfigurasi yang konsisten.

## File yang Dibuat

| File | Status |
|---|---|
| `packages/smart-config/package.json` | 🆕 `@smart/config` package |
| `packages/smart-config/eslint/index.js` | 🆕 Shared ESLint flat config |
| `packages/smart-config/vite/index.js` | 🆕 Shared Vite base config |

## Detail Konfigurasi

### ESLint (`eslint/index.js`)
- Format: Flat config (ESLint >= 9)
- Rules: `no-unused-vars`, `no-undef`, `prefer-const`, `eqeqeq`, `no-var`, dll.
- Browser globals: window, document, fetch, localStorage, dll.
- ✅ Tidak menyertakan globals spesifik aplikasi (Chart, AOS) — pure shared

### Vite (`vite/index.js`)
- Target: `es2020`
- Minify: esbuild
- CSS minify: true
- Sourcemap: false (production)

## Verifikasi

| Check | Hasil |
|---|---|
| `npm install` (root) | ✅ +1 package, 24 packages total, 0 vulnerabilities |
| `npm run build` (Inventory) | ✅ Built in 184ms, 0 errors |

## Catatan

- **Belum** menginstal ESLint sebagai dependency — akan dilakukan saat setup linter di T-014 nanti.
- **Belum** menghubungkan shared config ke Inventory — bersifat sebagai referensi/convention dulu.
- Vite config `server.port: 3000` bersifat default — setiap app bisa override di `vite.config.js` masing-masing.
