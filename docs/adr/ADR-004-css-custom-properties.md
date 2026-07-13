# ADR-004: CSS Custom Properties sebagai Design Token

**Status:** Accepted

**Tanggal:** July 13, 2026

## Context

SMART Platform membutuhkan sistem design token untuk menjaga konsistensi visual di semua aplikasi. Opsi yang dipertimbangkan: CSS Custom Properties, Sass/Less variables, Tailwind CSS, Styled Components, dan CSS-in-JS.

## Decision

Menggunakan **CSS Custom Properties** (CSS variables) sebagai implementasi Design Token.

Token didefinisikan di `:root` dalam file CSS terpisah per kategori:
- `colors.css` — brand, semantic, surface, text
- `typography.css` — font family, size, weight, line height
- `spacing.css` — spacing scale
- `radius.css` — border radius scale
- `shadow.css` — box shadow
- `animation.css` — duration, easing
- `breakpoints.css` — screen breakpoints

Workspace melakukan mapping (bukan redefinisi): `--primary: var(--blue-500)`.

## Rationale

- **Runtime theming** — CSS variables bisa diubah kapan saja (via workspace, user preference, dll)
- **Tanpa build step** — native browser support, tidak perlu preprocessor
- **Inheritance** — cascade alami CSS, token bisa di-override per komponen
- **Performance** — tidak ada runtime JS overhead seperti CSS-in-JS
- **Future-proof** — semakin didukung oleh browser dan tooling

## Consequences

- Tidak ada nesting (perlu CSS native nesting atau manual)
- Tidak ada mixin/fungsi (seperti Sass `darken()`, `lighten()`)
- Beberapa browser lama tidak mendukung (tidak relevan untuk target pengguna)
- Workspace hanya bisa mapping, tidak bisa membuat token baru (harus di design token layer)

## Trade-offs

- **Dibanding Sass/Less:** CSS variables lebih terbatas (tidak ada fungsi, mixin, loop). Tapi kompensasinya: runtime theming, tanpa build step, native browser support.
- **Dibanding Tailwind:** Tailwind punya utility-first approach yang berbeda. CSS variables lebih sederhana dan tidak perlu belajar class naming convention.
- **Dibanding CSS-in-JS:** Tidak ada runtime overhead, tidak ada bundle size tambahan, dan lebih mudah di-debug di browser DevTools.

## Related Decisions

- ADR-002: Workspace over Theme
- ADR-003: Vanilla JavaScript
