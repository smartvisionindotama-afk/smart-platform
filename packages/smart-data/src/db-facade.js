/**
 * DB Facade — Database SDK namespace.
 *
 * Menyediakan antarmuka database yang konsisten untuk semua aplikasi.
 * Aplikasi tidak boleh memakai MongoDB secara langsung.
 *
 * @module @smart/data/db-facade
 */

/**
 * Get company code from current session for multi-tenant scoping.
 * @returns {string|null}
 */
function _getCompanyCode() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SMART && globalThis.SMART.Session) {
            return globalThis.SMART.Session.get("company.code");
        }
    } catch {}
    return null;
}

/**
 * Build headers with company context.
 * @returns {object}
 */
function _headers() {
    const h = { "Content-Type": "application/json" };
    const code = _getCompanyCode();
    if (code) h["x-company-code"] = code;
    return h;
}

/**
 * Make an API request.
 * @param {string} method HTTP method
 * @param {string} name Collection name
 * @param {string} path API path
 * @param {object} [body] Request body
 * @param {object} [options] Additional options
 * @returns {Promise<object>}
 */
async function _request(method, name, path, body, options = {}) {
    const baseUrl = (typeof window !== 'undefined' && window.API_BASE_URL) || "";
    const apiUrl = baseUrl.replace(/\/+$/, "");
    const url = `${apiUrl}/api/${name}${path}`;

    const fetchOptions = {
        method,
        headers: { ..._headers(), ...options.headers },
        body: body ? JSON.stringify(body) : undefined
    };

    try {
        const res = await fetch(url, fetchOptions);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `DB Error: ${res.status}`);
        }
        return res.json();
    } catch (err) {
        if (err.message.includes("DB Error")) throw err;
        throw new Error(`[DB] ${method} /api/${name}${path} failed: ${err.message}`);
    }
}

/**
 * DB — Database SDK namespace (Facade).
 *
 * Contoh:
 *   DB.collection("barang").find({ page: 1, limit: 10 })
 *   DB.collection("users").insert({ name: "John" })
 *   DB.find("barang", { page: 1 })
 *   DB.insert("users", { name: "John" })
 */
export const DB = {
    /**
     * Get a collection proxy for CRUD operations.
     * @param {string} name Collection name
     * @returns {object} Collection proxy
     */
    collection(name) {
        return {
            async find(params = {}) {
                // Auto-add companyCode for multi-tenant isolation
                const companyCode = _getCompanyCode();
                const enriched = companyCode && !params.companyCode
                    ? { ...params, companyCode }
                    : { ...params };
                const qs = "?" + new URLSearchParams(
                    Object.fromEntries(
                        Object.entries(enriched).filter(([_, v]) => v !== undefined && v !== null && v !== "")
                    )
                ).toString();
                return _request("GET", name, qs);
            },

            async findOne(id) {
                return _request("GET", name, `/${id}`);
            },

            async insert(data) {
                const companyCode = _getCompanyCode();
                const enriched = companyCode
                    ? { ...data, companyCode, createdAt: Date.now(), updatedAt: Date.now() }
                    : { ...data, createdAt: Date.now(), updatedAt: Date.now() };
                return _request("POST", name, "", enriched);
            },

            async update(id, data) {
                return _request("PUT", name, `/${id}`, { ...data, updatedAt: Date.now() });
            },

            async delete(id) {
                return _request("DELETE", name, `/${id}`);
            },

            async aggregate(pipeline = []) {
                return _request("POST", name, "/aggregate", { pipeline });
            },

            async transaction(operations = []) {
                return _request("POST", name, "/transaction", { operations });
            },

            async batch(docs = []) {
                const companyCode = _getCompanyCode();
                const enriched = docs.map(d => companyCode
                    ? { ...d, companyCode, createdAt: Date.now(), updatedAt: Date.now() }
                    : { ...d, createdAt: Date.now(), updatedAt: Date.now() }
                );
                return _request("POST", name, "/batch", { data: enriched });
            },

            async watch(pipeline = []) {
                return _request("POST", name, "/watch", { pipeline });
            }
        };
    },

    async find(collection, params = {}) {
        return this.collection(collection).find(params);
    },

    async findOne(collection, id) {
        return this.collection(collection).findOne(id);
    },

    async insert(collection, data) {
        return this.collection(collection).insert(data);
    },

    async update(collection, id, data) {
        return this.collection(collection).update(id, data);
    },

    async delete(collection, id) {
        return this.collection(collection).delete(id);
    }
};

export default DB;
