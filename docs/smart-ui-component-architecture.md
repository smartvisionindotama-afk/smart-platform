# SMART UI Component Architecture Convention

**Status:** Adopted — EPIC-002 Phase 1
**Scope:** `packages/smart-ui/src/components/`

---

## 1. Component API Pattern

Every SMART UI component MUST follow the **Pure Function Component** pattern (ADR-005):

```js
export function ComponentName({ prop1, prop2 }) {
    // 1. Create element
    const el = document.createElement("div");

    // 2. Configure element
    el.className = "smart-component-name";
    el.innerText = prop1;

    // 3. Return element
    return el;
}
```

### Rules
- Components are **pure functions** — no side effects, no class instances
- Components **return DOM nodes** (not strings, not innerHTML for interactive components)
- Components receive all configuration via a **single `props` object**
- Components MUST NOT read from `window`, `document`, or global state directly

---

## 2. Props Naming Rules

### Convention: camelCase

| Rule | Example | Bad Example |
|---|---|---|
| Boolean props default to `false` | `disabled={false}` | `disabled="false"` |
| Event handler props prefix with `on` | `onClick`, `onChange`, `onSubmit` | `click`, `change` |
| Content props use plain names | `title`, `description`, `value` | `contentTitle`, `textValue` |
| Variant/type props use descriptive names | `variant="primary"`, `size="lg"` | `type="1"`, `s="large"` |

### Required Props Convention

```js
export function Button({
    text = "",          // String — always default to empty string
    type = "primary",   // String — document valid values
    size = "",          // String — empty means default size
    disabled = false,   // Boolean — always default to false
    onClick = null      // Function — default to null, check before calling
})
```

### Props order (alphabetical):
1. Content props (`title`, `description`, `value`, `text`)
2. Visual props (`type`, `variant`, `size`)
3. State props (`disabled`, `active`, `selected`)
4. Event props (`onClick`, `onChange`, `onSubmit`)

---

## 3. Event Handling Rules

### Inline Events

```js
export function Button({ onClick = null }) {
    const el = document.createElement("button");

    if (onClick) {
        el.addEventListener("click", onClick);
    }

    return el;
}
```

### Rules
1. Always check `if (onClick)` before attaching — allows consumers to omit the handler
2. Use `addEventListener()` — never use `onclick` property assignment
3. Pass the consumer's handler directly — don't wrap unless transforming arguments
4. For delegated events (e.g., Sidebar), attach once at a parent level

### Event Cleanup
- Components that return DOM nodes: event listeners live on the node itself
- When the node is removed from DOM, listeners are garbage collected automatically
- No manual cleanup needed for pure function components

---

## 4. CSS / Token Usage Rules

### 4.1 Token References Only

Components MUST reference **design tokens** from `src/tokens/`. Never use hardcoded values:

```css
/* ✅ CORRECT — use tokens */
.smart-btn-primary {
    background: var(--primary);
    color: var(--text-on-primary);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-sans);
}

/* ❌ WRONG — hardcoded values */
.smart-btn-primary {
    background: #2563eb;
    color: #ffffff;
    border-radius: 6px;
    padding: 8px 16px;
    font-family: Arial, sans-serif;
}
```

### 4.2 CSS Class Naming

Prefix all classes with `smart-`:

| Component | CSS Class | CSS File |
|---|---|---|
| Button | `.smart-btn`, `.smart-btn-primary` | `button.css` |
| Card | `.smart-card`, `.smart-card-title` | `card.css` |
| StatCard | `.smart-stat-card`, `.smart-stat-value` | `stat-card.css` |

### 4.3 Token Categories

| Category | Token Prefix | Example |
|---|---|---|
| Colors | `--primary`, `--surface`, `--text-*` | `--primary`, `--text-on-primary` |
| Spacing | `--space-*` | `--space-2` (8px), `--space-4` (16px) |
| Typography | `--font-*`, `--text-*` | `--font-sans`, `--text-sm` |
| Radius | `--radius-*` | `--radius-sm`, `--radius-md`, `--radius-lg` |
| Shadow | `--shadow-*` | `--shadow-sm`, `--shadow-md` |
| Breakpoints | `--bp-*` | `--bp-sm`, `--bp-md`, `--bp-lg` |

### 4.4 Component CSS File Structure

```css
/* 1. Component-specific variables (optional) */
.smart-component {
    --local-var: value;
}

/* 2. Base styles */
.smart-component {
    display: block;
    padding: var(--space-3);
    background: var(--surface);
    border-radius: var(--radius-md);
}

/* 3. Variants (if any) */
.smart-component-primary {
    background: var(--primary);
    color: var(--text-on-primary);
}

/* 4. States */
.smart-component:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

---

## 5. Import Rules

### JavaScript imports

```js
// ✅ CORRECT
import "../../tokens/index.css";   // Import design tokens
import "./component.css";          // Import component CSS

// Import from other components
import { Button } from "../button/button.js";
```

### CSS imports
Components MUST import design tokens explicitly:
```css
/* Already done via JS import of tokens/index.css */
```

No CSS `@import` — all CSS dependencies are handled by JavaScript imports.

---

## 6. Barrel Export

Every component MUST be re-exported from `src/components/index.js`:

```js
// src/components/index.js
export { Button } from "./button/button.js";
export { Card } from "./card/card.js";
export { StatCard } from "./stat-card/stat-card.js";
```

Consumers import via the barrel:
```js
import { Button, Card } from "@smart/ui/components";
// or
import { Button, Card, StatCard } from "@smart/ui";
```

---

## 7. Testing Requirements

Every component MUST have tests covering:

1. Element creation — correct tag name
2. CSS class names — correct classes applied
3. Content rendering — text/content appears in DOM
4. Props variants — each visual variant renders correctly
5. Event handlers — callbacks fire correctly
6. Edge cases — missing/null props don't crash

Test file location: `packages/smart-ui/__tests__/<component>.test.js`

---

*This convention applies to all components in `packages/smart-ui/src/components/`*
*Last updated: July 13, 2026*
