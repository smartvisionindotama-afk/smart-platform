# ADR-005: Component sebagai Pure Function

**Status:** Accepted

**Tanggal:** July 13, 2026

## Context

Setelah memutuskan Vanilla JavaScript (ADR-003), perlu ditentukan pattern untuk membuat komponen UI. Opsi: class-based (OOP), factory function, atau pure function.

## Decision

Component didefinisikan sebagai **pure function** yang menerima props dan mengembalikan DOM element.

```js
export function Button({ text = "", type = "primary", onClick = null }) {
    const el = document.createElement("button");
    el.className = `smart-btn smart-btn-${type}`;
    el.innerText = text;
    if (onClick) el.addEventListener("click", onClick);
    return el;
}
```

Tidak ada class, tidak ada `this`, tidak ada internal state. Component bisa dikomposisi (composition over inheritance).

## Rationale

- **Testable** — pure function tanpa side effects, mudah diuji
- **Predicable** — input sama, output sama. Tidak ada hidden state.
- **Tree-shakeable** — hanya import yang dipakai
- **Simple** — tanpa `this` binding, tanpa constructor, tanpa lifecycle
- **Composable** — komponen kompleks dibangun dari komponen sederhana

## Consequences

- Tidak ada internal state — perlu props drilling atau global state untuk data bersama
- Template strings untuk HTML bisa kurang terbaca untuk komponen kompleks
- Perlu disiplin untuk menjaga purity (tidak boleh ada side effects di function body)
- Event listener perlu di-attach manual (tidak ada event system seperti React SyntheticEvent)

## Trade-offs

- **Dibanding Class components:** Lebih sederhana, tanpa `this`, tanpa `new`, tanpa prototype chain. Tapi tidak bisa extend component lain.
- **Dibanding Factory function:** Pure function lebih mudah di-reason tentang input/output. Factory function biasanya punya lebih banyak fleksibilitas untuk private state.

## Related Decisions

- ADR-003: Vanilla JavaScript
- ADR-012: Template Strings untuk DOM
