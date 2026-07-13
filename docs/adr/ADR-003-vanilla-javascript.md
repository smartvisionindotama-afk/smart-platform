# ADR-003: Vanilla JavaScript (tanpa Framework)

**Status:** Accepted

**Tanggal:** July 13, 2026

## Context

Memilih teknologi untuk membangun SMART Platform. Opsi yang dipertimbangkan: React, Vue, Angular, Svelte, dan Vanilla JavaScript. Setiap framework memiliki ekosistem, learning curve, dan trade-off yang berbeda.

## Decision

Menggunakan **Vanilla JavaScript** (tanpa framework UI) untuk seluruh SMART Platform.

Component dibuat sebagai pure function yang mengembalikan DOM element. Tidak ada virtual DOM, tidak ada JSX, tidak ada reactive state management. Cukup ESM module + DOM API native.

## Rationale

- **Bundle size minimal** — tanpa framework, bundle lebih kecil dan load time lebih cepat
- **Kontrol penuh** — tidak terikat pada lifecycle framework tertentu
- **Longevity** — kode Vanilla JS yang ditulis hari ini masih akan berfungsi 10 tahun lagi tanpa migrasi framework
- **Learning curve rendah** — cukup tahu JavaScript, tidak perlu belajar framework baru
- **Tree-shakeable** — hanya import yang dipakai, tanpa overhead framework

## Consequences

- Tidak ada reactivity — perlu manual DOM manipulation
- Tidak ada tooling ecosystem (React DevTools, Vue DevTools)
- Developer harus disiplin dengan pattern komponen
- Hiring lebih sulit — developer biasanya mencari project React/Vue

## Trade-offs

- **Dibanding React:** Tidak ada virtual DOM, tidak ada JSX, tidak ada Hooks. Tapi bundle size jauh lebih kecil dan tidak perlu toolchain kompleks.
- **Dibanding Vue:** Tidak ada reactive data binding, template compiler, atau single-file components. Tapi tidak ada vendor lock-in dan build step lebih sederhana.
- **Dibanding Svelte:** Svelte punya bundle size kecil juga, tapi tetap perlu compiler step. Vanilla JS bisa jalan tanpa build step sama sekali.

## Related Decisions

- ADR-005: Pure Function Components
- ADR-012: Template Strings untuk DOM
