/**
 * SMART Console — SuperAdmin Data Service (API-based).
 *
 * Dipindahkan dari apps/inventory/src/data/superadmin-data.js (SP-027 Phase 1).
 * Superadmin disimpan di MongoDB via server API, bukan di client.
 *
 * SP-027 M3: login menyimpan JWT pair (access+refresh); seluruh request
 * menyertakan Authorization header; ada /me (validasi sesi) & logout.
 *
 * @module console/services/superadmins
 */

import {
    setAuthTokens,
    getAccessToken,
    getRefreshToken,
    clearAuthTokens,
    authorizedFetch
} from "@smart/api";

const API_BASE = "/api/superadmins";

/**
 * Login as superadmin via API — simpan JWT pair.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<object|null>} User data or null on failure
 */
export async function superadminLogin(username, password) {
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            credentials: "include", // terima httpOnly cookie refresh token
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) return null;
        const data = await res.json();
        setAuthTokens(data);
        return data;
    } catch (err) {
        console.warn("[SuperAdmin] Login API error:", err);
        return null;
    }
}

/**
 * GET /api/superadmins/me — validasi sesi dari access token (server-side).
 * @returns {Promise<object|null>}
 */
export async function getSuperAdminMe() {
    try {
        const token = getAccessToken();
        if (!token) return null;
        const res = await fetch(`${API_BASE}/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        console.warn("[SuperAdmin] /me API error:", err);
        return null;
    }
}

/**
 * POST /api/superadmins/logout — revoke refresh token di server.
 * Refresh token dikirim otomatis via httpOnly cookie (credentials: include);
 * body dipakai hanya sebagai fallback sesi lama.
 * @returns {Promise<boolean>}
 */
export async function superadminLogout() {
    try {
        const refreshToken = getRefreshToken();
        const res = await fetch(`${API_BASE}/logout`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: refreshToken ? JSON.stringify({ refreshToken }) : "{}"
        });
        clearAuthTokens();
        return res.ok;
    } catch (err) {
        console.warn("[SuperAdmin] Logout API error:", err);
        clearAuthTokens();
        return false;
    }
}

/**
 * POST /api/superadmins/impersonation-token — minta token impersonasi
 * bertanda tangan (SP-027 M3) untuk handoff ke aplikasi tujuan.
 * @param {object} payload { appSlug, companyCode, companyName }
 * @returns {Promise<string|null>}
 */
export async function requestImpersonationToken(payload) {
    try {
        const token = getAccessToken();
        if (!token) return null;
        const res = await fetch(`${API_BASE}/impersonation-token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            // Teruskan pesan error dari server (mis. 403 company belum terhubung)
            // agar Super Admin tahu alasan penolakan yang sebenarnya.
            const errData = await res.json().catch(() => ({}));
            const message = errData.error || `HTTP ${res.status}`;
            throw new Error(message);
        }
        const data = await res.json();
        return data.token || null;
    } catch (err) {
        if (err instanceof Error && err.message && !err.message.startsWith("HTTP ")) {
            throw err;
        }
        console.warn("[SuperAdmin] Impersonation token error:", err);
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
        const res = await authorizedFetch(API_BASE);
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
        const res = await authorizedFetch(API_BASE, {
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
        const res = await authorizedFetch(`${API_BASE}/${id}`, {
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
        const res = await authorizedFetch(`${API_BASE}/${id}`, {
            method: "DELETE"
        });
        return res.ok;
    } catch (err) {
        console.warn("[SuperAdmin] Delete API error:", err);
        return false;
    }
}
