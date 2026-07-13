# TASK T-028 s.d. T-030 — Hapus Direktori Lama
## Resume Hasil

**Sprint:** Sprint 4 — Layout Engine
**Status:** ✅ Selesai

## Direktori Dihapus
| Direktori | Reason |
|---|---|
| `apps/inventory/src/core/` | ✅ Sudah di-extract ke `@smart/core` |
| `apps/inventory/src/ui/` | ✅ Sudah di-extract ke `@smart/ui` |
| `apps/inventory/src/components/` | ✅ Topbar/Sidebar pindah ke Layout Engine |

## Struktur Inventory Setelah Cleanup
```
apps/inventory/src/
├── config/
├── css/
├── layouts/          ← Masih ada (kosong)
├── main.js           ← Entry point (refactored)
├── pages/
├── playground/
├── router/
└── (kosong: js, modules, services, utils)
```
