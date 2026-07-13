# SMART UI Component Development Guide

**Status:** Adopted — EPIC-002 Phase 1
**Audience:** Developers adding new components to `@smart/ui`

---

## Quick Start: Adding a New Component

### Step 1: Create component files

```
packages/smart-ui/src/components/
└── my-component/
    ├── my-component.js     # Component logic
    └── my-component.css    # Component styles
```

### Step 2: Write the component

```js
// src/components/my-component/my-component.js
import "../../tokens/index.css";
import "./my-component.css";

export function MyComponent({
    title = "",
    variant = "default",
    disabled = false,
    onClick = null
}) {

    const el = document.createElement("div");
    el.className = `smart-my-component smart-my-component-${variant}`;

    if (title) {
        const titleEl = document.createElement("h3");
        titleEl.className = "smart-my-component-title";
        titleEl.innerText = title;
        el.appendChild(titleEl);
    }

    if (onClick) {
        el.addEventListener("click", onClick);
    }

    if (disabled) {
        el.setAttribute("aria-disabled", "true");
    }

    return el;

}
```

### Step 3: Write CSS using design tokens

```css
/* src/components/my-component/my-component.css */
.smart-my-component {
    padding: var(--space-4);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
}

.smart-my-component-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--space-2);
}

.smart-my-component-default {
    /* Uses base styles only */
}

.smart-my-component-primary {
    background: var(--primary);
    color: var(--text-on-primary);
    border-color: var(--primary);
}
```

### Step 4: Register in barrel export

```js
// src/components/index.js — add to existing exports
export { MyComponent } from "./my-component/my-component.js";
```

### Step 5: Write tests

```js
// __tests__/my-component.test.js
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { MyComponent } from "../src/components/my-component/my-component.js";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.document = dom.window.document;
global.window = dom.window;

describe("MyComponent", () => {

    it("should create a div element", () => {
        const el = MyComponent({ title: "Test" });
        expect(el.tagName).toBe("DIV");
    });

    it("should have base class", () => {
        const el = MyComponent({ title: "Test" });
        expect(el.className).toContain("smart-my-component");
    });

    it("should render title", () => {
        const el = MyComponent({ title: "Hello" });
        const titleEl = el.querySelector(".smart-my-component-title");
        expect(titleEl.innerText).toBe("Hello");
    });

    it("should apply variant class", () => {
        const el = MyComponent({ title: "Test", variant: "primary" });
        expect(el.className).toContain("smart-my-component-primary");
    });

    it("should trigger onClick", () => {
        let clicked = false;
        const el = MyComponent({
            title: "Test",
            onClick: () => { clicked = true; }
        });
        el.click();
        expect(clicked).toBe(true);
    });

});
```

### Step 6: Verify

```bash
# From repository root
npm run verify
```

---

## Component Checklist

Before committing a new component, verify:

- [ ] All props use camelCase with sensible defaults
- [ ] CSS uses design tokens only (no hardcoded values)
- [ ] CSS classes prefixed with `smart-`
- [ ] Component is exported from `src/components/index.js`
- [ ] Tests cover: creation, classes, content, variants, events
- [ ] All 33+ existing tests still pass
- [ ] `npm run verify` passes (lint + test + build)

---

## Common Patterns

### Conditional content

```js
// Only render if prop is provided
if (title) {
    el.appendChild(titleEl);
}
```

### Boolean state

```js
// State-based class
if (active) {
    el.classList.add("smart-btn-active");
}

// ARIA attributes for accessibility
if (disabled) {
    el.setAttribute("aria-disabled", "true");
}
```

### Combining classes

```js
// Use template literals for dynamic classes
el.className = `smart-btn smart-btn-${type} ${size ? `smart-btn-${size}` : ""}`;
```

### Event handler pattern

```js
// Always check if handler exists before attaching
if (onClick) {
    el.addEventListener("click", onClick);
}
// No cleanup needed — DOM node lifecycle handles it
```

---

## Directory Structure

```
packages/smart-ui/src/
├── components/
│   ├── index.js              ← Barrel export (add new components here)
│   ├── button/
│   │   ├── button.js
│   │   └── button.css
│   ├── card/
│   │   ├── card.js
│   │   └── card.css
│   ├── stat-card/
│   │   ├── stat-card.js
│   │   └── stat-card.css
│   └── my-component/         ← YOUR NEW COMPONENT
│       ├── my-component.js
│       └── my-component.css
├── layouts/
│   ├── index.js
│   ├── shell/
│   │   └── Shell.js
│   ├── sidebar/
│   │   └── Sidebar.js
│   └── topbar/
│       └── Topbar.js
├── tokens/
│   ├── index.css
│   ├── colors.css
│   ├── typography.css
│   ├── spacing.css
│   ├── radius.css
│   ├── shadow.css
│   ├── breakpoints.css
│   └── animation.css
└── workspaces/
    ├── engine.js
    ├── schema.js
    ├── index.js
    ├── default/
    ├── warehouse/
    └── corporate/
```

---

## Available Design Tokens

### Colors
```css
--primary: #2563eb;
--primary-hover: #1d4ed8;
--secondary: #64748b;
--surface: #ffffff;
--surface-hover: #f8fafc;
--border: #e2e8f0;
--text-primary: #0f172a;
--text-secondary: #475569;
--text-on-primary: #ffffff;
--danger: #ef4444;
--success: #22c55e;
--warning: #f59e0b;
```

### Spacing
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### Typography
```css
--font-sans: "Inter", system-ui, -apple-system, sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", monospace;
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 1.875rem;
--text-4xl: 2.25rem;
```

### Border Radius
```css
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-xl: 12px;
--radius-full: 9999px;
```

---

## Testing Guidelines

### Running tests
```bash
npm test                    # Run all tests once
npm run test:watch          # Watch mode for development
npm run test:coverage       # Run tests with coverage report
```

### Writing test assertions

```js
// Element checks
expect(el.tagName).toBe("DIV");
expect(el.className).toContain("smart-component");

// Content checks
expect(el.innerText).toBe("Expected text");
expect(el.querySelector(".class")).not.toBeNull();

// State checks
expect(el.disabled).toBe(true);
expect(el.getAttribute("aria-label")).toBe("value");

// Event checks
let fired = false;
const el = Component({ onClick: () => { fired = true; } });
el.click();
expect(fired).toBe(true);
```

---

*Guide for SMART Platform component developers*
*Last updated: July 13, 2026*
