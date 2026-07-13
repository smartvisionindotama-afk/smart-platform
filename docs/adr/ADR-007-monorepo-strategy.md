# ADR-007: Monorepo Strategy

**Status:** Accepted

**Tanggal:** July 13, 2026

## Context

SMART Platform memiliki packages (`@smart/core`, `@smart/ui`) dan aplikasi (`inventory`, `eprofit`, `sitampan`, dll). Perlu strategi untuk mengelola semua kode ini. Opsi: monorepo (satu repo), multi-repo (repo per package/app), atau hybrid.

## Decision

Menggunakan **monorepo** dengan **npm workspaces**.

Root `package.json` mendefinisikan workspaces:
```json
{
  "name": "smart-platform",
  "private": true,
  "workspaces": ["packages/*", "apps/*"]
}
```

## Rationale

- **Satu `npm install`** untuk semua packages dan apps
- **Shared node_modules** — di-hoist ke root, mengurangi duplikasi
- **Cross-package imports** — `@smart/core` dan `@smart/ui` bisa di-import tanpa publish ke npm
- **Atomic commits** — perubahan di framework dan apps bisa dalam satu commit
- **Refactoring across boundaries** — rename fungsi di Core langsung bisa di-update di semua consumer
- **Zero configuration** — npm workspaces sudah built-in, tidak perlu tool tambahan

## Consequences

- Semua kode dalam satu repo — ukuran repo bisa besar
- CI/CD perlu di-desain untuk build hanya yang berubah (cache)
- Tidak bisa publish package ke npm (private packages sudah cukup)
- Perlu disiplin: commit message harus jelas scope-nya

## Trade-offs

- **Dibanding multi-repo:** Multi-repo punya isolasi yang lebih baik (satu repo broken tidak mempengaruhi yang lain). Tapi koordinasi antar repo lebih sulit (perlu version bump, publish, update dependency di setiap repo).
- **Dibanding publish ke npm:** npm publish memungkinkan versioning semantik dan independen. Tapi untuk project internal, overhead publish tidak sebanding dengan manfaatnya.

## Tools Considered

| Tool | Keputusan | Alasan |
|---|---|---|
| npm workspaces | ✅ **Dipilih** | Built-in, zero config, cukup untuk kebutuhan saat ini |
| pnpm workspaces | ⏸️ Dipertimbangkan | Lebih cepat dan lebih hemat disk, tapi perlu tool tambahan |
| Turborepo | ⏸️ Dipertimbangkan | Untuk caching build, akan dievaluasi saat build time menjadi issue |
| Nx | ❌ Tidak dipilih | Over-engineered untuk skala saat ini |

## Related Decisions

- ADR-001: SMART sebagai Platform
- ADR-006: Layer Independence
