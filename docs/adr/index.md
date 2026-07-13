# Architecture Decision Records (ADR)

Daftar keputusan arsitektur untuk SMART Platform.

| ADR | Judul | Status |
|---|---|---|
| ADR-001 | [SMART sebagai Platform](./ADR-001-smart-sebagai-platform.md) | ✅ Accepted |
| ADR-002 | [Workspace over Theme](./ADR-002-workspace-over-theme.md) | ✅ Accepted |
| ADR-003 | [Vanilla JavaScript](./ADR-003-vanilla-javascript.md) | ✅ Accepted |
| ADR-004 | [CSS Custom Properties](./ADR-004-css-custom-properties.md) | ✅ Accepted |
| ADR-005 | [Pure Function Components](./ADR-005-pure-function-components.md) | ✅ Accepted |
| ADR-006 | [Layer Independence](./ADR-006-layer-independence.md) | ✅ Accepted |
| ADR-007 | [Monorepo Strategy](./ADR-007-monorepo-strategy.md) | ✅ Accepted |

## ADR yang Perlu Dibuat (Future)

| ADR | Judul | Prioritas |
|---|---|---|
| ADR-008 | Module Architecture | 🟡 HIGH |
| ADR-009 | Plugin Architecture (Future) | 🟢 MEDIUM |
| ADR-010 | Workspace Experience Model | 🟢 MEDIUM |
| ADR-011 | In-App Router vs URL Router | 🟢 MEDIUM |
| ADR-012 | Template Strings untuk DOM | 🟢 MEDIUM |

## Template ADR

Setiap ADR mengikuti format:

```markdown
# ADR-NNN: Judul

**Status:** [Proposed | Accepted | Deprecated]

## Context
Latar belakang masalah dan opsi yang dipertimbangkan.

## Decision
Keputusan yang diambil.

## Rationale
Alasan mengapa keputusan ini diambil.

## Consequences
Dampak positif dan negatif.

## Trade-offs
Apa yang dikorbankan.

## Related Decisions
ADR lain yang terkait.
```
