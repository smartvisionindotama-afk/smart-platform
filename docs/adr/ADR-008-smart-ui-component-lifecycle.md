# ADR-008: SMART UI Component Lifecycle

**Status:** Accepted
**Date:** July 13, 2026
**Deciders:** Platform Architecture Team
**Context:** EPIC-002 Phase 2A — Standardizing component lifecycle for consistency and testability

---

## Decision

SMART UI components follow a **Create → Configure → Return** lifecycle pattern. There is no reactive state,
no virtual DOM, and no lifecycle hooks beyond the function call itself.

```
┌─────────────┐
│  Create     │  document.createElement("div")
│             │
├─────────────┤
│  Configure  │  Set properties, className, innerText
│             │
├─────────────┤
│  Attach     │  addEventListener (if handlers provided)
│             │
├─────────────┤
│  Return     │  return element (caller appends to DOM)
│             │
└─────────────┘
```

## Component Categories

### 1. Presentation Components (Badge, Avatar, StatCard)
- No state, no events
- Pure render based on props
- Return DOM node directly

### 2. Interactive Components (Button, Input, Select, Switch, Checkbox)
- Accept `onChange` / `onClick` / `onInput` handlers
- Use native HTML elements for form behavior
- Event listeners attached in the function body

### 3. Compound Components (Alert, Toast, Modal)
- May require show/hide state managed by the consumer
- Accept `visible` prop for conditional rendering
- For Modal: consumer controls visibility via a boolean `open` prop

## Patterns by Component Category

| Category | Example | State | Events | Lifecycle |
|---|---|---|---|---|
| Presentation | Badge, Avatar | None | None | Create → Configure → Return |
| Interactive | Input, Switch, Button | Props only | onClick/onChange | Create → Configure → Attach → Return |
| Compound | Modal, Toast | Consumer-managed | onClose | Create → Configure → Attach → Return (consumer controls visibility) |

## Return Value Convention

All SMART UI components return **DOM nodes** (never strings, never innerHTML for interactive components).

```js
// ✅ Correct — return DOM node
export function Badge({ text }) {
    const el = document.createElement("span");
    el.className = "smart-badge";
    el.innerText = text;
    return el;
}

// ✅ Correct — return DOM node (compound)
export function Modal({ open = false, children = "" }) {
    const el = document.createElement("div");
    el.className = `smart-modal ${open ? "smart-modal-open" : ""}`;
    el.innerHTML = children;
    return el;
}
```

## Consumer Responsibility

The caller (application code) is responsible for:
1. Appending returned nodes to the DOM via `appendChild()` or `innerHTML`
2. Managing show/hide state for compound components
3. Re-creating components when props change (no mutation)

## Rationale

- Vanilla JS (ADR-003) has no built-in reactive lifecycle
- Pure function components (ADR-005) enforce stateless rendering
- CSS Custom Properties (ADR-004) handle theme changes without re-rendering
- Keeps component surface area minimal and testable

## Consequences

- Positive: Components are predictable, testable, and framework-agnostic
- Positive: No lifecycle bugs (no mounting/unmounting edge cases)
- Negative: Consumers must re-create on prop change
- Negative: No built-in transition/animation lifecycle (handled via CSS)

---

*ADR-008 aligned with ADR-003 (Vanilla JS), ADR-004 (CSS Custom Properties), ADR-005 (Pure Functions)*
