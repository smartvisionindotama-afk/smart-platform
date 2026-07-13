# SMART PLATFORM — Second Application Validation

**Author:** Chief Software Architect, PT SMART VISION INDOTAMA  
**Date:** July 14, 2026  
**Phase:** Pre EPIC-006 — Platform Stabilization Mission  
**Status:** Complete

---

## 1. Executive Summary

The Inventory application alone is **insufficient proof** that SMART Platform is a general-purpose application framework. A second, architecturally distinct application is needed to validate:

- That the framework supports different domain models
- That the UI component library is genuinely reusable
- That the data layer (@smart/data) works end-to-end
- That the API layer (@smart/api) integrates correctly
- That permissions and multi-tenancy are configurable per-app

---

## 2. Proposed Application: **Task Management (Task Manager)**

### Why Task Management?

| Criterion | Evaluation |
|-----------|------------|
| **Domain complexity** | Medium — more complex than Inventory (CRUD + status workflows + assignments) |
| **Framework coverage** | High — exercises nearly every package |
| **Real business need** | Yes — every company needs task tracking |
| **Implementation risk** | Low — well-understood domain |
| **Demo value** | High — immediately understandable |

### What makes it different from Inventory?

| Aspect | Inventory | Task Management |
|--------|-----------|-----------------|
| Data model | Simple CRUD (barang, supplier, pembelian) | Status workflows, assignments, priorities, due dates |
| Views | Single-page lists | Kanban board, calendar, list view |
| Multi-user | Basic role check | Real assignments, notifications |
| Data layer | Not used (mock data) | MUST use @smart/data + @smart/api |
| Permission model | Menu-level only | Action-level (create task, assign, complete, delete) |

---

## 3. Framework Coverage Matrix

### Packages Used

| Package | Inventory Usage | Task Manager Usage | New Coverage? |
|---------|----------------|--------------------|---------------|
| `@smart/core` | ✅ Auth, Permission, Institution, AppConfig | ✅ Same + Institution switching | No — same usage |
| `@smart/api` | ❌ Not used | ✅ Full usage (client, interceptors, BaseResource) | **YES** |
| `@smart/data` | ❌ Not used | ✅ Full usage (Repository, state, cache, pagination) | **YES** |
| `@smart/ui` | ✅ Button, Card, StatCard, AppShell, Sidebar, Topbar | ✅ ALL components | **YES** (most components) |
| `@smart/config` | ❌ Not used | ✅ Vite config | **YES** |

### SMART UI Components Used

| Component | Inventory | Task Manager |
|-----------|-----------|--------------|
| Button | ✅ | ✅ |
| Card | ✅ | ✅ |
| StatCard | ✅ | ✅ |
| Input | ❌ | ✅ (task form) |
| Select | ❌ | ✅ (status/priority dropdowns) |
| Textarea | ❌ | ✅ (task description) |
| Checkbox | ❌ | ✅ (task completion) |
| Switch | ❌ | ❌ (no toggle use case) |
| Alert | ❌ | ✅ (notifications) |
| Toast | ❌ | ✅ (action feedback) |
| Modal | ❌ | ✅ (task detail/edit modal) |
| Badge | ❌ | ✅ (priority/status badges) |
| Avatar | ❌ | ✅ (assignee avatars) |
| Table | ❌ | ✅ (task list view) |
| Pagination | ❌ | ✅ (task list pagination) |
| EmptyState | ❌ | ✅ (no tasks) |
| Skeleton | ❌ | ✅ (loading states) |
| Tabs | ❌ | ✅ (Kanban/List/Calendar views) |
| Dropdown | ❌ | ✅ (actions menu) |
| Breadcrumb | ❌ | ✅ (navigation) |
| Container | ❌ | ✅ (layout containers) |
| Stack | ❌ | ✅ (button groups) |
| Divider | ❌ | ✅ (section separation) |

**Coverage increase:** From ~4 components (Button, Card, StatCard, AppShell) to **22 components** (100% of the library).

---

## 4. Data Layer Integration

### Proposed Architecture

```
apps/task-manager/
├── src/
│   ├── api/
│   │   ├── client.js          ← createClient() from @smart/api
│   │   └── resources/
│   │       ├── tasks.js        ← BaseResource extension
│   │       └── users.js        ← BaseResource extension
│   ├── data/
│   │   ├── task-repository.js  ← Repository from @smart/data
│   │   └── user-repository.js
│   ├── stores/
│   │   └── task-state.js       ← createDataState() from @smart/data
│   ├── pages/
│   │   ├── dashboard/
│   │   ├── tasks/
│   │   │   ├── list.js
│   │   │   ├── kanban.js
│   │   │   └── detail.js
│   │   └── users/
│   └── components/
│       ├── TaskCard.js
│       ├── KanbanColumn.js
│       ├── TaskForm.js
│       └── AssignmentPicker.js
```

### This validates:
- **API client + interceptors** (auth, context headers) actually work end-to-end
- **Repository pattern** works with real API resources
- **Cache invalidation** on CRUD operations
- **Pagination** with real data
- **State management** across multiple views

---

## 5. Expected Reusable Components

### Can be built with existing @smart/ui:

| Feature | Framework Components |
|---------|---------------------|
| Task list table | Table, Pagination, Badge, Avatar |
| Kanban board | Card, Stack, Container, Skeleton |
| Task form | Input, Select, Textarea, Button, Checkbox |
| Task detail | Modal, Card, Badge, Breadcrumb |
| Navigation | Tabs, Breadcrumb, Dropdown |
| Notifications | Toast, Alert |
| Empty/waiting | EmptyState, Skeleton |

---

## 6. Expected Missing Components

| Missing Component | Workaround | Should Be in Framework? |
|-------------------|------------|-------------------------|
| **DatePicker** | Native `<input type="date">` | Yes — common need |
| **FileUpload** | Custom implementation | Yes — common need |
| **ColorPicker** | Native `<input type="color">` | Nice to have |
| **RichText editor** | `<textarea>` | Nice to have |
| **Drawer/Panel** | Modal or custom | Yes — common need |
| **Notification Center** | Toast + custom | Yes — common need |
| **Confirm Dialog** | Modal with preset actions | Yes — common need |
| **Search Input** | Input with debounce | Should be added to smart-ui |
| **AutoComplete** | Select + custom logic | Should be added to smart-ui |
| **Progress Bar** | Custom CSS | Nice to have |
| **Tooltip** | CSS title attribute | Should be added to smart-ui |

### Total missing baseline components: ~6-8

This is reasonable for a v1.0 framework. The 22 existing components cover the vast majority of common UI patterns.

---

## 7. Expected Missing Framework Features

| Feature | Impact | Workaround |
|---------|--------|------------|
| **Form validation library** | HIGH — forms need validation | Manual validation in each form |
| **API error handling UI** | MEDIUM — Toast for errors | Manual integration |
| **Routing system** | HIGH — current router is app-specific | Custom router in each app |
| **State persistence** | MEDIUM — no URL state, no localStorage | Manual persistence |
| **Internationalization (i18n)** | LOW — Indonesian-only for now | Not needed initially |
| **Real-time updates** | LOW — REST is sufficient | Polling or WebSocket later |

---

## 8. Expected Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| @smart/data Repository not flexible enough for non-standard CRUD | Medium | High | Extend BaseResource or create custom data operations |
| @smart/api interceptors don't work without real backend | High | Medium | Create mock API layer or use MSW (Mock Service Worker) |
| Task Manager bundle becomes too large | Low | Medium | Tree-shaking should handle unused components |
| UI component customization limited | Medium | Medium | User may need to fork components |
| No routing system in framework | High | High | Either create a simple router or use a third-party one |
| CSS specificity conflicts with workspace themes | Low | Low | Workspace CSS variables handle this well |

---

## 9. Summary

### Recommendation: ✅ Proceed with Task Manager as the second validation application

### Rationale:
1. **Wide framework coverage** — exercises 100% of @smart/ui components
2. **Validates the data layer** — @smart/data and @smart/api are currently UNUSED in production
3. **Different domain** — proves the framework is not Inventory-specific
4. **Real business value** — has immediate internal use
5. **Reasonable risk** — well-understood domain, existing components cover most needs

### Suggested timeline: 2-3 sprints for a functional MVP

### Pre-requisites before building:
- [ ] Address HIGH findings from Architecture Audit (F-13, F-04)
- [ ] Write Getting Started guide
- [ ] Ensure all @smart/ui components have complete props documentation
- [ ] Create a mock API layer for development/testing

---

*End of Second Application Validation Report*
