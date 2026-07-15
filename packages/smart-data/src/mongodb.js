/**
 * MongoDB Connection Abstraction — Framework level.
 *
 * Provides connection configuration and factory for MongoDB-backed repositories.
 * Can be used by any SMART application.
 *
 * @module @smart/data/mongodb
 */

/**
 * Database configuration factory.
 * Creates configuration that can be overridden via environment or API_BASE_URL.
 *
 * @param {object} [options]
 * @param {string} [options.apiBaseUrl] API base URL (empty = use in-memory)
 * @param {number} [options.timeout] Connection timeout in ms (default: 5000)
 * @returns {object} DB config object
 */
export function createDbConfig(options = {}) {
    const config = {
        apiBaseUrl: options.apiBaseUrl || window.API_BASE_URL || "",
        timeout: options.timeout || 5000,

        get useInMemory() {
            return !this.apiBaseUrl;
        }
    };
    return config;
}

/**
 * Default database configuration singleton.
 * Can be overridden by setting window.API_BASE_URL before app start.
 */
export const dbConfig = createDbConfig();

/**
 * Check if the database backend is available.
 * In development, falls back to in-memory when no API is configured.
 *
 * @param {object} [config] DB config (defaults to dbConfig)
 * @returns {Promise<boolean>}
 */
export async function checkConnection(config = dbConfig) {
    if (!config.apiBaseUrl) {
        console.log("[DB] Using in-memory data store (no API configured)");
        return true;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);
        const res = await fetch(`${config.apiBaseUrl}/health`, {
            method: "GET",
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return res.ok;
    } catch {
        console.warn("[DB] API not available, falling back to in-memory");
        return false;
    }
}

/**
 * Create a repository factory that creates API-backed repositories.
 *
 * @param {string} baseUrl API base URL
 * @returns {object} Repository factory
 */
export function createApiRepository(baseUrl) {
    const apiUrl = baseUrl.replace(/\/+$/, "");

    return {
        /**
         * Generic fetch wrapper for API calls.
         * @param {string} resource Resource path (e.g., "/barang")
         * @param {object} [options] Fetch options
         * @returns {Promise<any>}
         */
        async request(resource, options = {}) {
            const url = `${apiUrl}${resource}`;
            const { method = "GET", body, params } = options;

            const query = params ? "?" + new URLSearchParams(params).toString() : "";
            const fullUrl = url + query;

            const res = await fetch(fullUrl, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers
                },
                body: body ? JSON.stringify(body) : undefined
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: res.statusText }));
                throw new Error(err.message || `API Error: ${res.status}`);
            }

            return res.json();
        }
    };
}

export default { dbConfig, createDbConfig, checkConnection, createApiRepository };
