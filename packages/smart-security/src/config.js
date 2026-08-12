/**
 * Security Configuration — env-driven, no secrets in source code.
 *
 * SP-027 M3: Semua secret & parameter keamanan diambil dari Environment
 * Variable. Jika tidak di-set, digunakan secret ephemeral (random per boot)
 * agar server tetap bisa berjalan saat development — sesi akan hilang saat
 * restart. Di production WAJIB set JWT_SECRET & JWT_REFRESH_SECRET.
 *
 * @module @smart/security/config
 */

import crypto from "crypto";

/** Generate secret ephemeral (per-boot) dengan warning. */
function ephemeral(name) {
    const secret = crypto.randomBytes(32).toString("hex");
    console.warn(
        `[Security] ${name} belum di-set di ENV — memakai secret ephemeral (sesi akan hilang saat server restart). Set ${name} di .env untuk produksi.`
    );
    return secret;
}

function parseIntSafe(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Build security configuration dari environment.
 * @param {object} [env] Environment object (default: process.env)
 * @returns {object} Security config
 */
export function securityConfig(env = process.env) {
    return {
        jwtSecret: env.JWT_SECRET || ephemeral("JWT_SECRET"),
        jwtRefreshSecret: env.JWT_REFRESH_SECRET || ephemeral("JWT_REFRESH_SECRET"),
        jwtExpiresIn: env.JWT_EXPIRES_IN || "15m",
        jwtRefreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN || "7d",
        bcryptRound: parseIntSafe(env.BCRYPT_ROUND, 10),
        cookieSecret: env.COOKIE_SECRET || ephemeral("COOKIE_SECRET"),

        // Refresh token httpOnly cookie (SP-027 M3 hardening)
        cookieName: env.COOKIE_NAME || "smart_refresh",
        // Secure flag: default true di production (https), bisa di-override eksplisit
        cookieSecure: env.COOKIE_SECURE === "true" || (env.NODE_ENV === "production" && env.COOKIE_SECURE !== "false"),

        // Rate limiting
        rateLimitAuthWindowMs: parseIntSafe(env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60 * 1000),
        rateLimitAuthMax: parseIntSafe(env.RATE_LIMIT_AUTH_MAX, 20),
        rateLimitApiWindowMs: parseIntSafe(env.RATE_LIMIT_API_WINDOW_MS, 15 * 60 * 1000),
        rateLimitApiMax: parseIntSafe(env.RATE_LIMIT_API_MAX, 600),

        // Impersonation token TTL (ms)
        impersonationTtlMs: parseIntSafe(env.IMPERSONATION_TTL_MS, 2 * 60 * 1000)
    };
}

export default securityConfig;
