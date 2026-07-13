# EPIC-004: SMART API Foundation

**Status:** ✅ Complete
**Date:** July 13, 2026

---

## Architecture Decision Record

| ADR | Title | Status |
|---|---|---|
| **ADR-010** | SMART API Foundation Architecture | Accepted |

---

## Package: `@smart/api`

### Structure

```
packages/smart-api/
├── package.json
├── src/
│   ├── index.js                  # Barrel export
│   ├── client.js                 # createClient() — fetch wrapper
│   ├── error.js                  # ApiError hierarchy
│   ├── interceptors/
│   │   ├── index.js              # Barrel
│   │   ├── auth.js               # Bearer token injection
│   │   └── context.js            # Institution, role, request-id headers
│   └── resources/
│       ├── index.js              # Barrel
│       └── base.js               # BaseResource CRUD class
└── __tests__/
    ├── client.test.js            # 16 tests
    ├── error.test.js             # 15 tests
    ├── interceptors.test.js      # 10 tests
    └── resources.test.js         # 14 tests
```

### HTTP Client (`createClient`)

```
createClient({ baseURL, headers, timeout, requestInterceptors, responseInterceptors })
```

| Method | Description |
|---|---|
| `get(path, opts)` | GET request with query params |
| `post(path, body, opts)` | POST with JSON body |
| `put(path, body, opts)` | PUT with JSON body |
| `patch(path, body, opts)` | PATCH with JSON body |
| `delete(path, opts)` | DELETE request |
| `use(fn)` | Register request interceptor |

### Error Hierarchy

```
ApiError (base)
├── NetworkError      — Status 0 (timeout, no connection)
├── AuthError         — 401 Unauthorized
├── ForbiddenError    — 403 Forbidden
├── NotFoundError     — 404 Not Found
├── ValidationError   — 422 Validation failed (+ fieldErrors)
└── ServerError       — 500+ Internal error
```

### Interceptors

| Interceptor | Headers | Source |
|---|---|---|
| `authRequestInterceptor` | `Authorization: Bearer <token>` | `Auth.token()` |
| `contextRequestInterceptor` | `X-Institution-Id` | `Institution.current().id` |
| | `X-User-Role` | `Auth.user().role` |
| | `X-App-Code` | `AppConfig.appCode` |
| | `X-Request-Id` | Generated UUID |

### Base Resource

```js
class BarangResource extends BaseResource {
    constructor(client) {
        super(client, "/barang");
    }
    async search(q) {
        return this.client.get("/barang/search", { params: { q } });
    }
}
```

| Method | HTTP |
|---|---|
| `list(params)` | GET /resource |
| `get(id)` | GET /resource/:id |
| `create(data)` | POST /resource |
| `update(id, data)` | PUT /resource/:id |
| `patch(id, data)` | PATCH /resource/:id |
| `delete(id)` | DELETE /resource/:id |

## Dependency Direction

```
@smart/api → @smart/core (Auth, Institution, AppConfig)
@smart/api → NO dependency on @smart/ui
@smart/api → fetch (built-in, no axios)
```

## Test Results

```
npm run verify
├── lint:      0 errors, 8 warnings ✅
├── test:      436/436 passed (17 files) ✅
└── build:     3 assets, 213ms ✅
```

### Test Breakdown

| Test File | Tests |
|---|---|
| `error.test.js` | 15 |
| `client.test.js` | 16 |
| `interceptors.test.js` | 10 |
| `resources.test.js` | 14 |
| Other (EPIC-001/002/003) | 381 |
| **Total** | **436** |

## Commit History

```
0ebe61a EPIC-004: @smart/api Package Foundation
0d054b6 ADR-010: SMART API Foundation Architecture
```

## ADR Compliance

- **ADR-003** (Vanilla JS): fetch wrapper, no axios or external HTTP libs ✅
- **ADR-006** (Layer Independence): @smart/api depends on @smart/core only, not @smart/ui ✅
- **ADR-007** (Monorepo): Package auto-included via workspaces ✅
- **ADR-009** (Identity): Auth token, user role, institution context integrated ✅
- **ADR-010** (API Foundation): Fully implemented ✅
