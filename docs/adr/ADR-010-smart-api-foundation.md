# ADR-010: SMART API Foundation Architecture

**Status:** Accepted

**Date:** July 13, 2026

**Context:** EPIC-004 — Building a centralized API client layer for the SMART Platform.

---

## Decision

Create `@smart/api` sebagai package terpisah yang menyediakan HTTP client abstraction, error handling standar, dan integrasi autentikasi.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                    Application                    │
│  (inventory, eprofit, sitampan, dll)              │
├──────────────────────────────────────────────────┤
│                   @smart/api                      │
│  client.js  →  HTTP client (fetch wrapper)         │
│  error.js   →  Error classes & handling            │
│  request.js →  Request builder                    │
│  response.js→  Response handler                   │
│  interceptors/                                     │
│    auth.js   →  Token injection & 401 handling     │
│    context.js→  Institution & correlation context  │
│  resources/                                        │
│    base.js   →  Base CRUD resource                │
├──────────────────────────────────────────────────┤
│                   @smart/core                      │
│  Auth, Permission, Institution, AppConfig          │
└──────────────────────────────────────────────────┘
```

### Dependency Direction

```
@smart/api → @smart/core (for Auth token, AppConfig apiUrl)
@smart/api → built-in fetch (no axios)
@smart/api → NO dependency on @smart/ui
```

## 1. HTTP Client Strategy

### Why fetch, not axios

| Factor | fetch | axios |
|---|---|---|
| Bundle size | 0 (built-in) | ~32KB min |
| Native ESM | Yes | Requires polyfill |
| Request/Response interceptor | Manual | Built-in |
| Upload progress | Limited | Built-in |
| Timeout | Manual | Built-in |

**Decision:** Menggunakan `fetch` dengan wrapper. Axios terlalu berat untuk SPA internal yang tidak membutuhkan upload progress.

### Client Configuration

```js
const api = createClient({
    baseURL: "http://localhost:3000/api",
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
    interceptors: {
        request: [authInterceptor, contextInterceptor],
        response: [errorInterceptor]
    }
});

// Usage
const users = await api.get("/users");
const user = await api.post("/users", { name: "New" });
```

## 2. Error Handling

### Error Hierarchy

```
ApiError (base)
├── NetworkError    — No connection, timeout, DNS failure
├── AuthError       — 401 Unauthorized
├── ForbiddenError  — 403 Forbidden
├── NotFoundError   — 404 Not Found
├── ValidationError — 422 Unprocessable Entity
└── ServerError     — 500+ Internal Server Error
```

### Error Shape

```js
{
    name: "AuthError",
    message: "Session expired",
    status: 401,
    code: "AUTH_EXPIRED",
    data: { /* response body */ },
    timestamp: "2026-07-13T12:00:00Z"
}
```

## 3. Authentication Integration

### Request Interceptor (auth)

```js
function authInterceptor(config) {
    const token = Auth.token();
    if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
}
```

### Response Interceptor (auth)

```js
function handleAuthError(error) {
    if (error instanceof AuthError) {
        Auth.logout();       // Clear session
        window.location.reload();  // Or redirect to login
    }
    throw error;
}
```

## 4. Context Propagation

### Request Headers

| Header | Source | Purpose |
|---|---|---|
| `Authorization` | `Auth.token()` | Bearer token |
| `X-Institution-Id` | `Institution.current().id` | Tenant context |
| `X-Request-Id` | Generated UUID | Request tracing |
| `X-App-Code` | `AppConfig.appCode` | Application identity |

## 5. Resource Pattern

### Base Resource

```js
class BaseResource {
    constructor(client, endpoint) {
        this.client = client;
        this.endpoint = endpoint;
    }

    async list(params)   { return this.client.get(this.endpoint, { params }); }
    async get(id)        { return this.client.get(`${this.endpoint}/${id}`); }
    async create(data)   { return this.client.post(this.endpoint, data); }
    async update(id, data) { return this.client.put(`${this.endpoint}/${id}`, data); }
    async delete(id)     { return this.client.delete(`${this.endpoint}/${id}`); }
}
```

### Concrete Resources (future — not in this ADR)

Each page/business domain will extend BaseResource:

```js
class BarangResource extends BaseResource {
    constructor(client) {
        super(client, "/barang");
    }
    async search(q) { return this.client.get("/barang/search", { params: { q } }); }
}
```

## 6. Package Structure

```
packages/smart-api/
├── package.json
├── src/
│   ├── index.js              # Barrel export
│   ├── client.js             # createClient() factory
│   ├── request.js            # RequestConfig builder
│   ├── response.js           # Response handler
│   ├── error.js              # Error classes
│   └── interceptors/
│       ├── index.js          # Barrel export
│       ├── auth.js           # Auth interceptor
│       └── context.js        # Context interceptor
├── __tests__/
│   ├── client.test.js
│   ├── error.test.js
│   └── interceptors.test.js
```

## Rationale

- **fetch over axios** — Zero dependency, smaller bundle, native ESM
- **Interceptor pattern** — Clean separation of concerns (auth, context, error handling)
- **Error hierarchy** — Consumers can catch specific error types
- **Configurable client** — Each app can create its own client with custom baseURL
- **Testable** — Client uses fetch which is mockable in tests

## Consequences

- Positive: All API interactions go through a single, consistent layer
- Positive: Auth token is automatically attached to all requests
- Positive: Errors are normalized regardless of backend implementation
- Positive: Adding new API resources is just extending BaseResource
- Negative: fetch doesn't support request cancellation natively (AbortController needed)
- Negative: Custom timeout implementation needed (fetch doesn't have built-in timeout)
- Negative: No automatic retry for transient failures (future enhancement)

## Related Decisions

- ADR-003: Vanilla JavaScript
- ADR-006: Layer Independence
- ADR-007: Monorepo Strategy
- ADR-009: SMART Identity & Security Architecture
