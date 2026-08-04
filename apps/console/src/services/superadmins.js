/**
 * SMART Console — SuperAdmin Data Service (API-based).
 *
 * Dipindahkan dari apps/inventory/src/data/superadmin-data.js (SP-027 Phase 1).
 * Superadmin disimpan di MongoDB via server API, bukan di client.
 *
 * @module console/services/superadmins
 */

const API_BASE = "/api/superadmins";

/**
 * Login as superadmin via API.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<object|null>} User data or null on failure
 */
export async function superadminLogin(username, password) {
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        console.warn("[SuperAdmin] Login API error:", err);
        return null;
    }
}

/**
 * List all superadmins.
 *
 * @returns {Promise<object[]>}
 */
export async function listSuperadmins() {
    try {
        const res = await fetch(API_BASE);
        if (!res.ok) return [];
        return await res.json();
    } catch (err) {
        console.warn("[SuperAdmin] List API error:", err);
        return [];
    }
}

/**
 * Create a new superadmin.
 *
 * @param {object} data { username, password, name, email, active }
 * @returns {Promise<object|null>}
 */
export async function createSuperadmin(data) {
    try {
        const res = await fetch(API_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
        }
        return await res.json();
    } catch (err) {
        console.warn("[SuperAdmin] Create API error:", err);
        throw err;
    }
}

/**
 * Update a superadmin.
 *
 * @param {string} id MongoDB _id
 * @param {object} data Fields to update
 * @returns {Promise<object|null>}
 */
export async function updateSuperadmin(id, data) {
    try {
        const res = await fetch(`${API_BASE}/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
        }
        return await res.json();
    } catch (err) {
        console.warn("[SuperAdmin] Update API error:", err);
        throw err;
    }
}

/**
 * Delete a superadmin.
 *
 * @param {string} id MongoDB _id
 * @returns {Promise<boolean>}
 */
export async function deleteSuperadmin(id) {
    try {
        const res = await fetch(`${API_BASE}/${id}`, {
            method: "DELETE"
        });
        return res.ok;
    } catch (err) {
        console.warn("[SuperAdmin] Delete API error:", err);
        return false;
    }
}
