/**
 * HTTP Security — security headers (helmet) & CORS configuration.
 *
 * SP-027 M3: helmet dipasang dengan CSP dinonaktifkan (SPA memakai <style>
 * inline), COOP/CORP dilonggarkan agar logo lintas-origin (data URL &
 * master.e-profit.id → inv.e-profit.id) tetap bisa dimuat.
 *
 * @module @smart/security/http
 */

import helmet from "helmet";

/**
 * Security headers middleware (helmet).
 * @returns {Function} Express middleware
 */
export function securityHeaders() {
    return helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: { policy: "unsafe-none" },
        crossOriginResourcePolicy: { policy: "cross-origin" },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" }
    });
}

/**
 * Daftar origin CORS dari ENV (CORS_ORIGINS, comma-separated),
 * fallback ke daftar default development.
 * @param {object} env Environment
 * @param {Array} [defaults]
 * @returns {Array}
 */
export function corsOriginsFromEnv(env, defaults = []) {
    const raw = String(env.CORS_ORIGINS || "").trim();
    if (!raw) {
        return defaults;
    }
    return raw
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
}

export default { securityHeaders, corsOriginsFromEnv };
