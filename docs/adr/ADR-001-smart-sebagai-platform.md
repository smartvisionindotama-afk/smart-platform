# ADR-001: SMART adalah Platform, bukan Aplikasi

**Status:** Accepted

**Tanggal:** July 13, 2026

## Context

Proyek dimulai dengan membangun aplikasi SMART Inventory. Namun, visi perusahaan adalah memiliki banyak aplikasi (e-Profit, SITAMPAN, SantriPintar, Desa Insight, CRM, ERP, HRM, dll) yang berbagi fondasi yang sama. Tanpa keputusan arsitektur yang jelas, setiap aplikasi akan dibangun dari nol atau melakukan copy-paste kode.

## Decision

SMART bukan sebuah aplikasi. SMART adalah Platform. Inventory hanyalah aplikasi pertama.

Seluruh keputusan arsitektur harus mempertimbangkan minimal 10 aplikasi di masa depan. Framework (packages/) dipisah dari aplikasi (apps/). Framework dapat digunakan oleh aplikasi manapun tanpa copy-paste.

## Rationale

- Mencegah code duplication antar aplikasi
- Satu sumber kebenaran untuk design token, komponen, dan business engine
- Memungkinkan aplikasi baru dibuat dalam hitungan hari, bukan bulan
- Biaya maintainability lebih rendah dibanding multi-repo/copy-paste

## Consequences

- Perlu setup monorepo (npm workspaces)
- Perlu ekstraksi SMART Core dan SMART UI ke package independen
- Learning curve lebih tinggi untuk developer baru
- Inventory tidak bisa bergerak secepat startup karena harus mempertimbangkan platform

## Trade-offs

- **Keuntungan:** Semua aplikasi SMART punya fondasi yang sama. Satu perbaikan di framework, semua aplikasi mendapat manfaat.
- **Risiko:** Over-engineering. Jika hanya ada 1-2 aplikasi, biaya setup platform mungkin tidak sebanding.
- **Mitigasi:** Prinsip YAGNI — hanya buat yang dibutuhkan oleh aplikasi saat ini, tapi pastikan arsitektur mendukung ekstensi.

## Related Decisions

- ADR-007: Monorepo Strategy
