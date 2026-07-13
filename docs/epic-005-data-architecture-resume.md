# EPIC-005: SMART Data Architecture Foundation

**Status:** ✅ Complete
**Date:** July 13, 2026

---

## Architecture Decision Record

| ADR | Title | Status |
|---|---|---|
| **ADR-011** | SMART Data Architecture | Accepted |

---

## Package: `@smart/data`

### Structure

```
packages/smart-data/
├── package.json
├── src/
│   ├── index.js                  # Barrel export
│   ├── state.js                  # createDataState()
│   ├── cache.js                  # createCache() / clearAllCaches()
│   ├── pagination.js             # createPagination()
│   └── repository.js             # Repository class
└── __tests__/
    ├── state.test.js             # 14 tests
    ├── cache.test.js             # 14 tests
    ├── pagination.test.js        # 20 tests
    └── repository.test.js        # 24 tests
```

## Dependency Direction

```
@smart/data  → @smart/api  (BaseResource, ApiError)
@smart/api   → @smart/core (Auth, Institution, AppConfig)
@smart/data  → NO dependency on @smart/ui
@smart/data  → NO framework dependency
```

## Components

### DataState

```
createDataState() → { getState, startLoading, setData, setError, reset, onChange }
```

| Method | Description |
|---|---|
| `getState()` | Snapshot of current state |
| `startLoading(preserveData)` | Set loading=true, optionally keep existing data |
| `setData(data, pagination)` | Set data (clears loading/error) |
| `setError(error, preserveData)` | Set error (clears loading, optionally preserve data) |
| `reset()` | Back to initial state |
| `onChange(cb)` | Subscribe to state changes |

**State:** `{ data, loading, error, pagination, timestamp }`

### Cache

```
createCache(name) → { get, set, has, remove, clear, size }
```

| Feature | Detail |
|---|---|
| TTL | Configurable per entry (default: 60s) |
| Auto-expiry | Expired entries removed on read |
| Named stores | Multiple independent cache stores |
| `clearAllCaches()` | Global cache reset |

### Pagination

```
createPagination({ page, limit, total }) → { getMeta, goTo, next, prev, updateMeta, reset, onChange }
```

| Meta | Description |
|---|---|
| `page` | Current page |
| `limit` | Items per page |
| `total` | Total items |
| `totalPages` | Calculated (ceil) |
| `hasNext` | page < totalPages |
| `hasPrev` | page > 1 |

### Repository

```
new Repository(resource, { cache, pagination, cacheTtl })
```

| Method | Cache | Pagination |
|---|---|---|
| `fetchAll(params)` | Check → Fetch → Store | Merges page/limit |
| `fetchById(id)` | Check → Fetch → Store | — |
| `create(data)` | Invalidates list cache | Resets pagination |
| `update(id, data)` | Invalidates get + list caches | — |
| `delete(id)` | Invalidates get + list caches | Resets pagination |
| `reset()` | — | Resets |

## Test Results

```
npm run verify
├── lint:      0 errors, 8 warnings ✅
├── test:      508/508 passed (21 files) ✅
└── build:     3 assets, 206ms ✅
```

### @smart/data Test Breakdown

| File | Tests | Coverage |
|---|---|---|
| `state.test.js` | 14 | Initial state, transitions, onChange |
| `cache.test.js` | 14 | CRUD, TTL expiry, named stores |
| `pagination.test.js` | 20 | Navigation, meta, edge cases, onChange |
| `repository.test.js` | 24 | CRUD, state transitions, cache invalidation |
| **Total** | **72** | |

## Commit History

```
e055934 EPIC-005: @smart/data Package Foundation
5b9aeef ADR-011: SMART Data Architecture
```

## ADR Compliance

- **ADR-003** (Vanilla JS): No framework dependency ✅
- **ADR-006** (Layer Independence): No dependency on @smart/ui ✅
- **ADR-007** (Monorepo): Auto-included via workspaces ✅
- **ADR-010** (API Foundation): Uses @smart/api BaseResource ✅
- **ADR-011** (Data Architecture): Fully implemented ✅
