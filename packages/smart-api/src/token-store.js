/**
 * Token Store — penyimpanan & refresh JWT di sisi client.
 *
 * SP-027 M3 hardening:
 *   - Access token  : localStorage (dibaca JS untuk Authorization header).
 *   - Refresh token : httpOnly cookie (dikirim otomatis browser, TIDAK bisa
 *     dibaca JavaScript → mitigasi XSS). Server me-revoke & me-rotate via
 *     cookie; body refreshToken tetap didukung untuk sesi lama (migrasi).
 *
 * Seluruh request otomatis menyertakan Authorization header; saat access
 * token kadaluarsa (401), dilakukan refresh sekali (cookie otomatis) lalu retry.
 *
 * @module @smart/api/token-store
 */

const ACCESS_KEY = "smart_access_token";
// Legacy key — refresh token lama yang pernah disimpan sebelum hardening.
// Masih dibaca sebagai fallback migrasi sesi lama, TIDAK lagi ditulis.
const REFRESH_KEY = "smart_refresh_token";

let _config = {
    refreshPath: "/api/auth/refresh",
    onSessionExpired: null
};

let _refreshPromise = null;

/**
 * Konfigurasi token store.
 * @param {object} opts
 * @param {string} [opts.refreshPath] Path endpoint refresh (default /api/auth/refresh)
 * @param {Function} [opts.onSessionExpired] Callback saat refresh gagal (redirect login)
 */
export function configureAuthTokens(opts = {}) {
    _config = { ..._config, ...opts };
}

export function getAccessToken() {
    try {
        return localStorage.getItem(ACCESS_KEY);
    } catch {
        return null;
    }
}

/** @deprecated Refresh token kini httpOnly cookie — key ini legacy (sesi lama). */
export function getRefreshToken() {
    try {
        return localStorage.getItem(REFRESH_KEY);
    } catch {
        return null;
    }
}

/**
 * Simpan access token dari response login/refresh/register.
 * Refresh token TIDAK disimpan di localStorage (kini httpOnly cookie).
 * @param {object} data { accessToken, expiresIn, ... }
 */
export function setAuthTokens(data = {}) {
    try {
        if (data.accessToken) localStorage.setItem(ACCESS_KEY, data.accessToken);
        // Legacy cleanup: hapus refresh token lama dari localStorage
        if (data.accessToken) localStorage.removeItem(REFRESH_KEY);
    } catch {
        // localStorage unavailable — abaikan
    }
}

export function clearAuthTokens() {
    try {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
    } catch {
        // localStorage unavailable — abaikan
    }
}

/**
 * Refresh access token — cookie httpOnly dikirim otomatis (credentials).
 * Fallback: sesi lama yang masih punya refreshToken di localStorage dikirim
 * via body (backward compat selama masa transisi).
 * @returns {Promise<string|null>} Access token baru atau null jika gagal
 */
export async function refreshAccessToken() {
    if (_refreshPromise) {
        return _refreshPromise;
    }

    _refreshPromise = (async () => {
        // Legacy fallback: refresh token lama di localStorage (sesi pra-hardening)
        const legacyToken = getRefreshToken();

        try {
            const res = await fetch(_config.refreshPath, {
                method: "POST",
                credentials: "include", // kirim httpOnly cookie refresh token
                headers: { "Content-Type": "application/json" },
                // Body kosong — cookie sudah cukup untuk sesi baru. Untuk sesi
                // lama (belum punya cookie), kirim refreshToken legacy via body.
                body: legacyToken ? JSON.stringify({ refreshToken: legacyToken }) : "{}"
            });
            if (!res.ok) {
                throw new Error(`Refresh failed: ${res.status}`);
            }
            const data = await res.json();
            setAuthTokens(data);
            return data.accessToken || null;
        } catch (err) {
            console.warn("[TokenStore] Refresh gagal:", err.message);
            clearAuthTokens();
            handleSessionExpired();
            return null;
        } finally {
            _refreshPromise = null;
        }
    })();

    return _refreshPromise;
}

/**
 * fetch dengan Authorization header + credentials + retry otomatis saat 401.
 * @param {string} url
 * @param {object} options fetch options
 * @returns {Promise<Response>}
 */
export async function authorizedFetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = getAccessToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    let res = await fetch(url, { ...options, headers, credentials: "include" });

    if (res.status === 401 && token) {
        const fresh = await refreshAccessToken();
        if (fresh) {
            headers.Authorization = `Bearer ${fresh}`;
            res = await fetch(url, { ...options, headers, credentials: "include" });
        }
    }

    return res;
}

function handleSessionExpired() {
    try {
        if (typeof _config.onSessionExpired === "function") {
            _config.onSessionExpired();
        }
    } catch (err) {
        console.warn("[TokenStore] onSessionExpired error:", err);
    }
}

export default {
    configureAuthTokens,
    getAccessToken,
    getRefreshToken,
    setAuthTokens,
    clearAuthTokens,
    refreshAccessToken,
    authorizedFetch
};
