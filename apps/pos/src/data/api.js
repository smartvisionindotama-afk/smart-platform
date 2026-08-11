/**
 * API Client — Re-exports framework API utilities with Inventory-specific context.
 *
 * Keeps the convenience functions that Inventory pages use,
 * but delegates actual API logic to @smart/api framework.
 *
 * @module inventory/data/api
 */

export {
    buildQuery,
    normalizeItem,
    normalizeList,
    apiListFallback,
    apiCreateFallback,
    apiUpdateFallback,
    apiDeleteFallback,
    apiGetFallback,
    configureAuthTokens,
    setAuthTokens,
    clearAuthTokens,
    getAccessToken,
    getRefreshToken,
    refreshAccessToken,
    authorizedFetch
} from "@smart/api";

// Import terpisah untuk pemakaian lokal (re-export tidak membuat binding lokal)
import {
    setAuthTokens,
    authorizedFetch
} from "@smart/api";

let _apiAvailable = null;
let _apiCheckPromise = null;

/**
 * Check if the backend API is available (cached).
 * @returns {Promise<boolean>}
 */
export async function isApiAvailable() {
    if (_apiAvailable !== null) return _apiAvailable;
    if (_apiCheckPromise) return _apiCheckPromise;

    _apiCheckPromise = (async () => {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);
            const res = await fetch("/api/health", {
                method: "GET",
                signal: controller.signal
            });
            clearTimeout(timeout);
            _apiAvailable = res.ok;
        } catch {
            _apiAvailable = false;
            console.log("[API] Backend not available, using local data");
        }
        return _apiAvailable;
    })();

    return _apiCheckPromise;
}

/**
 * Make an API call. Returns null if API is not available.
 *
 * SP-027 M3: otomatis menyertakan `Authorization: Bearer <accessToken>`
 * (JWT) via authorizedFetch, plus retry saat 401 (refresh token sekali).
 *
 * Automatically includes `x-company-code` header for multi-tenant isolation.
 * The company code comes from company-context.js (set after login).
 */
export async function apiCall(method, path, body = null) {
    if (!(await isApiAvailable())) return null;

    const headers = { "Content-Type": "application/json" };

    // Attach company context for multi-tenant data isolation
    let companyCode = null;
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SMART) {
            companyCode = globalThis.SMART.Session.get("company.code") || globalThis.SMART.Company.getCode();
        }
    } catch {}
    if (companyCode) {
        headers["x-company-code"] = companyCode;
    }

    // Attach user name for activity logging
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SMART) {
            const user = globalThis.SMART.Session.get("user");
            if (user?.name) headers["x-user-name"] = user.name;
        }
    } catch {}

    const options = {
        method,
        headers
    };
    if (body && method !== "GET") {
        options.body = JSON.stringify(body);
    }

    const res = await authorizedFetch(`/api${path}`, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `API Error: ${res.status}`);
    }
    return res.json();
}

/**
 * Try an API call first; if null/error, call fallback function.
 */
export async function withApiFallback(method, path, body, fallbackFn) {
    try {
        const result = await apiCall(method, path, body);
        if (result !== null) return result;
    } catch (err) {
        console.warn(`[API] ${method} ${path} failed, using local:`, err.message);
    }
    return fallbackFn();
}

/**
 * Auth login via API. Returns user data or null.
 * SP-027 M3: simpan JWT pair (access + refresh) dari response login.
 */
export async function apiLogin(username, password) {
    try {
        const result = await apiCall("POST", "/auth/login", { username, password });
        if (result) {
            setAuthTokens(result);
            return result;
        }
    } catch {
        // Fall through to local auth
    }
    return null;
}
