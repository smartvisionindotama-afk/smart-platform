/**
 * @smart/security — Server Security Foundation (SP-027 M3).
 *
 * ████████████████████████████████████████████████████████████
 * PUBLIC SDK — SERVER SIDE SECURITY
 * ████████████████████████████████████████████████████████████
 *
 * Dipakai oleh server apps/console & apps/inventory (import via relative
 * path). Menyediakan:
 *
 *   - password.js  : bcrypt hash/verify + deteksi plaintext
 *   - tokens.js    : JWT access/refresh/impersonation + sha256
 *   - middleware.js: authenticate / authorize / permission / companyScope
 *   - rate-limit.js: proteksi brute-force
 *   - http.js      : helmet & CORS
 *   - validation.js: sanitasi input
 *   - audit.js     : audit log keamanan
 *   - migrate.js   : migrasi password plaintext → bcrypt
 *
 * @module @smart/security
 */

export { securityConfig, default as config } from "./config.js";
export { hashPassword, verifyPassword, isBcryptHash, isPlainPassword, hashPasswordIfPlain } from "./password.js";
export { verifyGoogleCredential } from "./google-verify.js";
export { parseCookies, buildCookie, clearCookie } from "./cookies.js";
export {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    sha256,
    signImpersonationToken,
    verifyImpersonationToken,
    randomSecret,
    refreshTokenExpiryMs,
    accessTokenTtlSeconds
} from "./tokens.js";
export { cleanString, validateLoginInput, validateNewPassword, isValidEmail } from "./validation.js";
export { createAuthRateLimiter, createApiRateLimiter } from "./rate-limit.js";
export { securityHeaders, corsOriginsFromEnv } from "./http.js";
export { createAuditLogger } from "./audit.js";
export { createMiddleware, hasPermission } from "./middleware.js";
export { migratePlaintextPasswords } from "./migrate.js";
