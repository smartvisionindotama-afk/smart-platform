/**
 * API Facade — API SDK namespace.
 *
 * Aplikasi tidak boleh memakai fetch() secara langsung.
 * Gunakan API Facade untuk semua komunikasi HTTP.
 *
 * @module @smart/api/api-facade
 */

/**
 * Get company code from current session for multi-tenant scoping.
 * @returns {string|null}
 */
function _getCompanyCode() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SMART) {
            return globalThis.SMART.Session.get("company.code") || globalThis.SMART.Company.getCode();
        }
    } catch {}
    return null;
}

/**
 * Build headers with company context.
 * @returns {object}
 */
function _headers(customHeaders = {}) {
    const h = { "Content-Type": "application/json", ...customHeaders };
    const code = _getCompanyCode();
    if (code) h["x-company-code"] = code;
    return h;
}

/**
 * Make an API request.
 * @param {string} method HTTP method
 * @param {string} url Full URL or path
 * @param {object|null} body Request body
 * @param {object} [options] Additional options
 * @returns {Promise<object>}
 */
async function _request(method, url, body = null, options = {}) {
    const baseUrl = (typeof window !== 'undefined' && window.API_BASE_URL) || "";
    const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;

    const fetchOptions = {
        method,
        headers: _headers(options.headers),
        body: body ? JSON.stringify(body) : undefined,
        signal: options.signal || null
    };

    if (options.responseType === "blob") {
        delete fetchOptions.headers["Content-Type"];
    }

    try {
        const res = await fetch(fullUrl, fetchOptions);

        if (options.responseType === "blob") {
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            return res.blob();
        }

        const contentType = res.headers.get("content-type") || "";
        let data = null;
        if (contentType.includes("application/json")) {
            data = await res.json();
        } else {
            data = await res.text();
        }

        if (!res.ok) {
            throw new Error(data?.error || data?.message || `API Error: ${res.status}`);
        }
        return data;
    } catch (err) {
        if (err.message.includes("API Error") || err.message.includes("NetworkError")) throw err;
        throw new Error(`[API] ${method} ${url} failed: ${err.message}`);
    }
}

// ── Backward-compatible helpers ──

/** @deprecated Gunakan SMART.Session.get("company.code") */
export function apiGetCompanyCode() {
    return _getCompanyCode();
}

/** @deprecated Gunakan langsung di API methods */
export function apiHeaders(customHeaders = {}) {
    return _headers(customHeaders);
}

/**
 * API — API SDK namespace (Facade).
 *
 * Contoh:
 *   API.get("/api/barang", { page: 1 })
 *   API.post("/api/barang", { nama: "Semen" })
 *   API.put("/api/barang/1", { harga: 50000 })
 *   API.delete("/api/barang/1")
 *   API.upload("/api/files", file)
 *   API.download("/api/reports/sales")
 */
export const API = {
    async get(url, params = {}, options = {}) {
        const qs = Object.keys(params).length > 0
            ? "?" + new URLSearchParams(
                Object.fromEntries(
                    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== "")
                )
              ).toString()
            : "";
        return _request("GET", `${url}${qs}`, null, options);
    },

    async post(url, body = null, options = {}) {
        return _request("POST", url, body, options);
    },

    async put(url, body = null, options = {}) {
        return _request("PUT", url, body, options);
    },

    async patch(url, body = null, options = {}) {
        return _request("PATCH", url, body, options);
    },

    async delete(url, options = {}) {
        return _request("DELETE", url, null, options);
    },

    async upload(url, formData, options = {}) {
        const baseUrl = (typeof window !== 'undefined' && window.API_BASE_URL) || "";
        const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
        const headers = {};
        const code = _getCompanyCode();
        if (code) headers["x-company-code"] = code;

        const res = await fetch(fullUrl, {
            method: "POST",
            headers,
            body: formData,
            signal: options.signal || null
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `Upload Error: ${res.status}`);
        }
        return res.json();
    },

    async download(url, options = {}) {
        return _request("GET", url, null, { ...options, responseType: "blob" });
    }
};

export default API;
