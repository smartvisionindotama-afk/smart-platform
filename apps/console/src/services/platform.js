/**
 * SMART Console — Platform Services.
 *
 * Logo platform & logo per-aplikasi disimpan di server (file-based)
 * sehingga bisa diakses dari seluruh subdomain e-profit.id.
 *
 * SP-027 PRE-M5 round 2: GET logo publik (tanpa token), sedangkan
 * POST/DELETE wajib otentikasi (hanya GET yang ada di PUBLIC_RULES) —
 * pakai authorizedFetch (Bearer access token superadmin + retry refresh)
 * agar upload/hapus tidak gagal 401.
 *
 * @module console/services/platform
 */

import { authorizedFetch } from "@smart/api";

/**
 * Upload logo platform ke server.
 * @param {string} dataUrl Data URL logo
 */
export async function uploadLogoToServer(dataUrl) {
    const res = await authorizedFetch("/api/platform/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: dataUrl })
    });
    if (!res.ok) throw new Error((await res.json()).error || "Gagal menyimpan logo");
}

/**
 * Hapus logo platform dari server.
 */
export async function removeLogoFromServer() {
    const res = await authorizedFetch("/api/platform/logo", { method: "DELETE" });
    if (!res.ok) throw new Error((await res.json()).error || "Gagal menghapus logo");
}

// Cache in-memory per sesi (slug → Promise) — mencegah N fetch saat render
// tabel/daftar. Di-invalidate saat upload/remove dari aplikasi ini.
const _logoCache = new Map();

async function _loadLogo(slug) {
    // Server adalah sumber kebenaran (fresh); localStorage hanya fallback
    // saat server tidak menjawab (offline/maint).
    try {
        const res = await fetch(`/api/platform/app-logo/${slug}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.logo) {
                try { localStorage.setItem(`smart_app_logo_${slug}`, data.logo); } catch { /* ignore */ }
                return data.logo;
            }
        }
    } catch { /* silent */ }
    try {
        return localStorage.getItem(`smart_app_logo_${slug}`);
    } catch {
        return null;
    }
}

/**
 * Ambil logo aplikasi — server-first, cache in-memory per sesi + localStorage.
 * @param {string} slug App slug (mis. "inventory")
 * @returns {Promise<string|null>} Data URL logo atau null
 */
export function getAppLogo(slug) {
    if (!_logoCache.has(slug)) {
        _logoCache.set(slug, _loadLogo(slug));
    }
    return _logoCache.get(slug);
}

/**
 * Upload logo aplikasi ke server.
 * @param {string} slug App slug (mis. "inventory")
 * @param {string} dataUrl Data URL logo
 */
export async function uploadAppLogoToServer(slug, dataUrl) {
    const res = await authorizedFetch(`/api/platform/app-logo/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: dataUrl })
    });
    if (!res.ok) throw new Error((await res.json()).error || "Gagal menyimpan logo aplikasi");
    try { localStorage.setItem(`smart_app_logo_${slug}`, dataUrl); } catch { /* ignore */ }
    _logoCache.set(slug, Promise.resolve(dataUrl));
}

/**
 * Hapus logo aplikasi dari server.
 * @param {string} slug App slug
 */
export async function removeAppLogoFromServer(slug) {
    const res = await authorizedFetch(`/api/platform/app-logo/${slug}`, { method: "DELETE" });
    if (!res.ok) throw new Error((await res.json()).error || "Gagal menghapus logo aplikasi");
    try { localStorage.removeItem(`smart_app_logo_${slug}`); } catch { /* ignore */ }
    _logoCache.delete(slug);
}
