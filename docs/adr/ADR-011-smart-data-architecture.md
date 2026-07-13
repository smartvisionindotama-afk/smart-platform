# ADR-011: SMART Data Architecture

**Status:** Accepted

**Date:** July 13, 2026

**Context:** EPIC-005 — Building a centralized data access layer for the SMART Platform.

---

## Decision

Create `@smart/data` sebagai package terpisah yang menyediakan standardized data access pattern, caching, pagination, dan state management untuk frontend.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                    Application                    │
│  (inventory, eprofit, sitampan, dll)              │
├──────────────────────────────────────────────────┤
│                   @smart/data                     │
│  repository/  → Repository pattern (state mgmt)   │
│  cache/       → In-memory TTL cache               │
│  state/       → DataState model                   │
│  pagination/  → Pagination handler                │
├──────────────────────────────────────────────────┤
│                   @smart/api                      │
│  client.js    → HTTP client (fetch wrapper)        │
│  error.js     → Error classes                      │
│  resources/   → BaseResource CRUD                  │
├──────────────────────────────────────────────────┤
│                   @smart/core                      │
│  Auth, Permission, Institution, AppConfig          │
└──────────────────────────────────────────────────┘
```

### Dependency Direction

```
@smart/data → @smart/api (for BaseResource, error classes)
@smart/api  → @smart/core
@smart/data → NO dependency on @smart/ui
@smart/data → NO framework dependency
```

## 1. DataState Model

### State Shape

```js
{
    data: null,       // The loaded data (array, object, etc.)
    loading: false,   // Whether a request is in flight
    error: null,      // ApiError instance if failed
    pagination: null, // PaginationMeta if paginated
    timestamp: null   // When data was last loaded
}
```

### State Transitions

```
IDLE (data=null, loading=false, error=null)
  → LOADING (data=null, loading=true, error=null)
    → SUCCESS (data=[...], loading=false, error=null)
    → ERROR (data=null, loading=false, error=ApiError)
  → RELOADING (data=[...], loading=true, error=null)
    → SUCCESS (data=[...], loading=false, error=null)
    → ERROR (data=[...], loading=false, error=ApiError)
```

### Helper Methods

```js
const state = createDataState();

state.startLoading()     → { loading: true }
state.setData(result)    → { data, loading: false, error: null, timestamp }
state.setError(error)    → { error, loading: false }
state.reset()            → { data: null, loading: false, error: null }
```

## 2. Caching Strategy

### In-Memory Cache with TTL

- Cache key: string (usually endpoint path + params hash)
- Cache value: { data, timestamp, ttl }
- TTL: configurable per entry, default 60 seconds
- Auto-expiry on read: expired entries treated as cache miss
- Manual operations: get, set, has, remove, clear

```js
const cache = createCache({ defaultTtl: 60000 });

cache.set("barang.list", data, 30000);     // custom TTL
const item = cache.get("barang.list");       // returns null if expired
cache.remove("barang.list");                // remove single
cache.clear();                              // remove all
```

### Caching Rules

| Operation | Cache Behavior |
|---|---|
| `list(params)` | Cache by params hash, invalidate on create/update/delete |
| `get(id)` | Cache by id, invalidate on update/delete |
| `create(data)` | Skip cache (write-through) |
| `update(id, data)` | Invalidate get(id) cache |
| `delete(id)` | Invalidate get(id) and list caches |

## 3. Pagination Handler

### Pagination Meta

```js
{
    page: 1,          // Current page
    limit: 10,        // Items per page
    total: 100,       // Total items
    totalPages: 10,   // Calculated
    hasNext: true,    // page < totalPages
    hasPrev: false    // page > 1
}
```

### Pagination Actions

```js
const pagination = createPagination({ page: 1, limit: 10, total: 0 });

pagination.next()         → page+1 (if hasNext)
pagination.prev()         → page-1 (if hasPrev)
pagination.goTo(5)        → page 5
pagination.updateMeta({ total: 50 })  → recalculate
pagination.reset()        → page 1
```

## 4. Repository Pattern

### Repository

Repository menggabungkan API resource, state management, caching, dan pagination menjadi satu kesatuan.

```js
class Repository {
    constructor(resource, { cache, pagination } = {}) {
        this.resource = resource;       // BaseResource instance
        this.state = createDataState();
        this.cache = cache || null;
        this.pagination = pagination || null;
    }

    async fetchAll(params)    → state with list data
    async fetchById(id)       → state with single item
    async create(data)        → state with created item
    async update(id, data)    → state with updated item
    async delete(id)          → void (invalidate cache)
}
```

### State Changes

Tiap method Repository mengupdate state sehingga UI bisa subscribe:

```js
const repo = new Repository(barangResource, {
    cache: barangCache,
    pagination: barangPagination
});

// UI reads
repo.state.data       // current data
repo.state.loading    // loading flag
repo.state.error      // error if any
repo.onChange(cb)     // subscribe to changes
```

## 5. Package Structure

```
packages/smart-data/
├── package.json
├── src/
│   ├── index.js                  # Barrel export
│   ├── state.js                  # createDataState()
│   ├── cache.js                  # createCache()
│   ├── pagination.js             # createPagination()
│   └── repository.js             # Repository class
└── __tests__/
    ├── state.test.js
    ├── cache.test.js
    ├── pagination.test.js
    └── repository.test.js
```

## Rationale

- **DataState pattern** — Standardized state shape across all data fetching
- **Cache layer** — Reduces redundant API calls, improves perceived performance
- **Pagination handler** — Consistent pagination logic across list views
- **Repository pattern** — Single class fetches, caches, and manages state for a resource
- **No framework dependency** — Works with any UI pattern (Vanilla JS, React, etc.)

## Consequences

- Positive: All data fetching follows the same pattern
- Positive: Cache reduces API calls
- Positive: Repository combines fetch + cache + state in one place
- Negative: In-memory cache lost on page refresh
- Negative: Manual cache invalidation needed after mutations

## Related Decisions

- ADR-003: Vanilla JavaScript
- ADR-006: Layer Independence
- ADR-007: Monorepo Strategy
- ADR-009: Identity & Security
- ADR-010: API Foundation
