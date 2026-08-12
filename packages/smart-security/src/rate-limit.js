/**
 * Rate Limiting — proteksi endpoint dari brute-force & abuse.
 *
 * SP-027 M3: limiter ketat untuk endpoint autentikasi, limiter umum untuk
 * seluruh API.
 *
 * @module @smart/security/rate-limit
 */

import rateLimit from "express-rate-limit";

/**
 * Limiter untuk endpoint autentikasi (login, refresh, forgot/reset password).
 * @param {object} cfg Security config
 * @returns {Function} Express middleware
 */
export function createAuthRateLimiter(cfg) {
    return rateLimit({
        windowMs: cfg.rateLimitAuthWindowMs,
        max: cfg.rateLimitAuthMax,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: { error: "Terlalu banyak percobaan. Silakan coba lagi nanti." }
    });
}

/**
 * Limiter umum untuk seluruh API.
 * @param {object} cfg Security config
 * @returns {Function} Express middleware
 */
export function createApiRateLimiter(cfg) {
    return rateLimit({
        windowMs: cfg.rateLimitApiWindowMs,
        max: cfg.rateLimitApiMax,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: { error: "Terlalu banyak request. Silakan coba lagi nanti." }
    });
}

export default { createAuthRateLimiter, createApiRateLimiter };
