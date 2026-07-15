/**
 * API Fallback Utilities — API-first with local fallback pattern.
 *
 * Provides helper functions that try an API call first,
 * then fall back to a local function if the API is unavailable.
 * Includes response normalization for MongoDB _id → id mapping.
 *
 * @module @smart/api/fallback
 */

/**
 * Build query string from params object.
 * @param {object} params
 * @returns {string}
 */
export function buildQuery(params = {}) {
    const q = {};
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") {
            q[k] = String(v);
        }
    }
    const s = new URLSearchParams(q).toString();
    return s ? "?" + s : "";
}

/**
 * Normalize a single item from an API response.
 * Maps MongoDB `_id` to string `id` for frontend consistency.
 *
 * @param {object|null} item
 * @returns {object|null}
 */
export function normalizeItem(item) {
    if (!item) return null;
    if (item._id && !item.id) {
        item.id = String(item._id);
    }
    return item;
}

/**
 * Normalize a paginated list response from the API.
 * Maps `_id` → `id` for every item in `data`.
 *
 * @param {{ data: object[], pagination: object }} response
 * @returns {{ data: object[], pagination: object }}
 */
export function normalizeList(response) {
    if (!response || !response.data) return response;
    response.data = response.data.map(normalizeItem);
    return response;
}

/**
 * Make an API call with fetch. Returns null if fetch fails.
 *
 * @param {string} method HTTP method
 * @param {string} url Full URL
 * @param {object|null} body Request body
 * @param {object} [options]
 * @param {object} [options.headers] Additional headers
 * @param {string} [options.companyCode] Company code for multi-tenant header
 * @returns {Promise<object|null>}
 */
export async function apiFetch(method, url, body = null, options = {}) {
    const headers = { "Content-Type": "application/json", ...options.headers };

    if (options.companyCode) {
        headers["x-company-code"] = options.companyCode;
    }

    const fetchOptions = { method, headers };
    if (body && method !== "GET") {
        fetchOptions.body = JSON.stringify(body);
    }

    try {
        const res = await fetch(url, fetchOptions);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `API Error: ${res.status}`);
        }
        return res.json();
    } catch (err) {
        console.warn(`[API] ${method} ${url} failed:`, err.message);
        return null;
    }
}

/**
 * Try an API call first; if null/error, call fallback function.
 *
 * @param {string} method HTTP method
 * @param {string} path API path
 * @param {object|null} body Request body
 * @param {function} fallbackFn Local fallback function
 * @param {object} [options] Additional fetch options
 * @returns {Promise<object|null>}
 */
export async function withFallback(method, path, body, fallbackFn, options = {}) {
    const result = await apiFetch(method, path, body, options);
    if (result !== null) return result;
    return fallbackFn();
}

/**
 * Try an API list call and normalize the paginated response;
 * fall back to local function if unavailable.
 *
 * @param {string} path API path
 * @param {object} params Query parameters
 * @param {function} fallbackFn Local fallback function
 * @param {object} [options] Additional options
 * @returns {Promise<{data: object[], pagination: object}>}
 */
export async function apiListFallback(path, params, fallbackFn, options = {}) {
    const qs = buildQuery(params);
    const baseUrl = options.baseUrl || "";
    const result = await apiFetch("GET", `${baseUrl}${path}${qs}`, null, options);
    if (result !== null) return normalizeList(result);
    return fallbackFn();
}

/**
 * Try an API create call and normalize the single-item response.
 *
 * @param {string} path API path
 * @param {object} body Request body
 * @param {function} fallbackFn Local fallback function
 * @param {object} [options] Additional options
 * @returns {Promise<object|null>}
 */
export async function apiCreateFallback(path, body, fallbackFn, options = {}) {
    const baseUrl = options.baseUrl || "";
    const result = await apiFetch("POST", `${baseUrl}${path}`, body, options);
    if (result !== null) return normalizeItem(result);
    return fallbackFn();
}

/**
 * Try an API update call and normalize the single-item response.
 *
 * @param {string} path API path
 * @param {string|number} id Entity ID
 * @param {object} body Request body
 * @param {function} fallbackFn Local fallback function
 * @param {object} [options] Additional options
 * @returns {Promise<object|null>}
 */
export async function apiUpdateFallback(path, id, body, fallbackFn, options = {}) {
    const baseUrl = options.baseUrl || "";
    const result = await apiFetch("PUT", `${baseUrl}${path}/${id}`, body, options);
    if (result !== null) return normalizeItem(result);
    return fallbackFn();
}

/**
 * Try an API delete call.
 *
 * @param {string} path API path
 * @param {string|number} id Entity ID
 * @param {function} fallbackFn Local fallback function
 * @param {object} [options] Additional options
 * @returns {Promise<boolean|object>}
 */
export async function apiDeleteFallback(path, id, fallbackFn, options = {}) {
    const baseUrl = options.baseUrl || "";
    const result = await apiFetch("DELETE", `${baseUrl}${path}/${id}`, null, options);
    if (result !== null) return result;
    return fallbackFn();
}

/**
 * Try an API GET single-item call and normalize.
 *
 * @param {string} path API path
 * @param {string|number} id Entity ID
 * @param {function} fallbackFn Local fallback function
 * @param {object} [options] Additional options
 * @returns {Promise<object|null>}
 */
export async function apiGetFallback(path, id, fallbackFn, options = {}) {
    const baseUrl = options.baseUrl || "";
    const result = await apiFetch("GET", `${baseUrl}${path}/${id}`, null, options);
    if (result !== null) return normalizeItem(result);
    return fallbackFn();
}
