# ADR-002: Workspace over Theme

**Status:** Accepted

**Tanggal:** July 13, 2026

## Context

Aplikasi SMART melayani berbagai jenis organisasi (gudang, perusahaan, BUMDes, pesantren, dll). Masing-masing memiliki kebutuhan branding, layout, dan pengalaman pengguna yang berbeda. Pendekatan tradisional (theme) hanya mengubah warna, tapi tidak cukup untuk perbedaan layout dan navigasi.

## Decision

Menggunakan konsep **Workspace** bukan **Theme**.

Workspace adalah Experience — mencakup branding, layout, navigasi, dashboard, login, menu, dan pengalaman pengguna secara keseluruhan. Workspace dapat memiliki:
- `variables.css` — visual tokens
- `workspace.json` — konfigurasi
- Layout override (sidebar, topbar, login, dashboard)

Theme adalah subset dari Workspace. Workspace lebih dari sekedar skin.

## Rationale

- Theme hanya mengubah warna — Workspace mengubah layout, navigasi, branding
- Dynamic import memungkinkan lazy loading — app hanya load workspace yang diperlukan
- Isolasi antar workspace — perubahan di satu workspace tidak mempengaruhi yang lain
- Mempersiapkan arsitektur untuk multi-tenant di masa depan

## Consequences

- Kompleksitas lebih tinggi dari theme system
- Workspace engine perlu di-maintain secara terpisah
- Perlu definisi yang jelas tentang apa yang bisa di-override oleh workspace

## Trade-offs

- **Dibanding Theme murni:** Lebih kompleks tapi lebih powerful. Workspace bisa mengganti layout sepenuhnya.
- **Dibanding CSS variables saja:** Workspace mencakup lebih dari visual — bisa include JS config (menu structure, dashboard layout).

## Related Decisions

- ADR-004: CSS Custom Properties
- ADR-010: Workspace Experience Model
