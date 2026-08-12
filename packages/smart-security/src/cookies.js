/**
 * Cookie Helpers — parse/build/clear cookie untuk refresh token httpOnly.
 *
 * SP-027 M3 hardening: refresh token kini juga dikirim sebagai httpOnly cookie
 * (bukan hanya di body/localStorage), sehingga client tidak bisa membaca token
 * via JavaScript (mitigasi XSS). Body refreshToken TETAP didukung untuk
 * backward compatibility (sesi lama / non-browser).
 *
 * @module @smart/security/cookies
 */

/**
 * Parse header Cookie menjadi object { name: value }.
 * @param {string} header Nilai header "Cookie" (bisa kosong)
 * @returns {object}
 */
export function parseCookies(header = "") {
    const out = {};
    if (!header || typeof header !== "string") return out;
    for (const part of header.split(";")) {
        const idx = part.indexOf("=");
        if (idx === -1) continue;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!key) continue;
        try {
            out[key] = decodeURIComponent(value);
        } catch {
            out[key] = value;
        }
    }
    return out;
}

/**
 * Build header Set-Cookie.
 * @param {string} name
 * @param {string} value
 * @param {object} [opts]
 * @param {boolean} [opts.httpOnly=true]
 * @param {boolean} [opts.secure]
 * @param {string} [opts.sameSite="lax"]
 * @param {string} [opts.path="/"]
 * @param {number|null} [opts.maxAgeSeconds] Max-Age dalam detik (null = session cookie)
 * @returns {string}
 */
export function buildCookie(name, value, {
    httpOnly = true,
    secure = false,
    sameSite = "lax",
    path = "/",
    maxAgeSeconds = null
} = {}) {
    const parts = [`${name}=${encodeURIComponent(String(value))}`, `Path=${path}`];
    if (httpOnly) parts.push("HttpOnly");
    if (secure) parts.push("Secure");
    if (sameSite) parts.push(`SameSite=${sameSite}`);
    if (maxAgeSeconds != null && Number.isFinite(maxAgeSeconds)) {
        parts.push(`Max-Age=${Math.floor(maxAgeSeconds)}`);
    }
    return parts.join("; ");
}

/**
 * Build header Set-Cookie untuk menghapus cookie.
 * @param {string} name
 * @param {object} [opts]
 * @returns {string}
 */
export function clearCookie(name, { secure = false, sameSite = "lax", path = "/" } = {}) {
    return buildCookie(name, "", { httpOnly: true, secure, sameSite, path, maxAgeSeconds: 0 });
}

export default { parseCookies, buildCookie, clearCookie };
