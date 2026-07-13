# ADR-006: Layer Independence

**Status:** Accepted

**Tanggal:** July 13, 2026

## Context

SMART Platform terdiri dari beberapa layer: SMART Core, SMART UI, SMART API, dan SMART Apps. Jika layer saling bergantung secara berlebihan, perubahan di satu layer bisa berdampak ke layer lain. Ini menghambat evolusi platform.

## Decision

Setiap layer harus bisa berkembang secara **independen**. Ketergantungan antar layer hanya satu arah:

```
Apps → UI → Core
Apps → Core
```

**Aturan:**
- SMART Core **tidak boleh mengetahui** SMART UI
- SMART Core **tidak boleh mengetahui** Workspace
- SMART Core **tidak boleh mengetahui** Theme
- SMART UI **tidak boleh mengetahui** aplikasi spesifik
- Komponen **tidak boleh mengetahui** aplikasi

## Rationale

- Core bisa di-test tanpa browser (tanpa DOM)
- UI bisa di-replace tanpa mengubah logika bisnis
- Aplikasi baru bisa pakai Core + UI tanpa modifikasi framework
- Layer independen bisa di-version, di-deploy secara terpisah

## Pelanggaran yang Diperbaiki

Workspace loader awalnya ada di Core (`apps/inventory/src/core/workspace/workspace.js`) dan meng-import dari `../../ui/workspaces/`. Ini adalah pelanggaran Layer Independence. Diperbaiki dengan memindahkan workspace engine ke SMART UI (`packages/smart-ui/src/workspaces/engine.js`).

## Consequences

- Perlu ada mekanisme komunikasi antar layer (events, dependency injection)
- Tidak boleh ada import dari UI ke Core
- Testing lebih mudah — setiap layer bisa di-test secara independen
- Arsitektur lebih jelas dan mudah dipahami

## Related Decisions

- ADR-001: SMART sebagai Platform
- ADR-007: Monorepo Strategy
