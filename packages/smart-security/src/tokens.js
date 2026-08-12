/**
 * JWT Tokens — access token, refresh token, impersonation token.
 *
 * SP-027 M3:
 *   - Access token  : short-lived (default 15m), memuat identitas & klaim RBAC
 *   - Refresh token : long-lived (default 7d), disimpan (hash) untuk revoke
 *   - Impersonation token: short-lived, ditandatangani server Console dan
 *     diverifikasi server aplikasi (handoff "Login As" yang aman).
 *
 * @module @smart/security/tokens
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";

const ISSUER = "smart-platform";

/**
 * Sign access token (JWT).
 *
 * Klaim `aud` (audience) membedakan server penerbit ("console" | "inventory")
 * agar token superadmin Console TIDAK bisa dipakai di API Inventory dan
 * sebaliknya (SP-027 M3 hardening — kedua server berbagi JWT_SECRET untuk
 * keperluan token impersonasi).
 *
 * @param {object} user User object { id|_id, name, username, role, companyCode|institution }
 * @param {object} cfg Security config
 * @param {string} [type] "user" | "superadmin"
 * @param {string} [audience] "console" | "inventory" (fallback: cfg.audience)
 * @returns {string}
 */
export function signAccessToken(user, cfg, type = "user", audience) {
    const payload = {
        sub: String(user.id ?? user._id ?? ""),
        type,
        name: user.name || "",
        username: user.username || "",
        role: user.role || "user",
        companyCode: user.companyCode || user.institution || null
    };
    if (audience || cfg.audience) {
        payload.aud = audience || cfg.audience;
    }
    return jwt.sign(payload, cfg.jwtSecret, {
        expiresIn: cfg.jwtExpiresIn,
        issuer: ISSUER
    });
}

/**
 * Sign refresh token (JWT) — berisi jti untuk identifikasi di store.
 * @param {object} user
 * @param {object} cfg
 * @param {string} [type]
 * @param {string} [audience]
 * @returns {string}
 */
export function signRefreshToken(user, cfg, type = "user", audience) {
    const payload = {
        sub: String(user.id ?? user._id ?? ""),
        type,
        role: user.role || "user",
        companyCode: user.companyCode || user.institution || null,
        name: user.name || "",
        jti: crypto.randomBytes(12).toString("hex")
    };
    if (audience || cfg.audience) {
        payload.aud = audience || cfg.audience;
    }
    return jwt.sign(payload, cfg.jwtRefreshSecret, {
        expiresIn: cfg.jwtRefreshExpiresIn,
        issuer: ISSUER
    });
}

/**
 * Verify access token. Throws jika invalid / kadaluarsa.
 * @param {string} token
 * @param {object} cfg
 * @returns {object} JWT payload
 */
export function verifyAccessToken(token, cfg) {
    return jwt.verify(token, cfg.jwtSecret, { issuer: ISSUER });
}

/**
 * Verify refresh token. Throws jika invalid / kadaluarsa.
 * @param {string} token
 * @param {object} cfg
 * @returns {object} JWT payload
 */
export function verifyRefreshToken(token, cfg) {
    return jwt.verify(token, cfg.jwtRefreshSecret, { issuer: ISSUER });
}

/**
 * SHA-256 hash — untuk menyimpan refresh token secara aman (tidak plaintext).
 * @param {string} value
 * @returns {string}
 */
export function sha256(value) {
    return crypto.createHash("sha256").update(String(value)).digest("hex");
}

/**
 * Sign impersonation token (dipakai server Console, diverifikasi server app).
 * @param {object} payload { superAdminId, superAdminName, companyCode, companyName, userId, userName, role, application }
 * @param {object} cfg
 * @param {number} [ttlMs]
 * @returns {string}
 */
export function signImpersonationToken(payload, cfg, ttlMs = cfg.impersonationTtlMs) {
    const claims = {
        ...payload,
        type: "impersonation",
        iat: Math.floor(Date.now() / 1000)
    };
    return jwt.sign(claims, cfg.jwtSecret, {
        expiresIn: Math.max(1, Math.floor(ttlMs / 1000)),
        issuer: ISSUER
    });
}

/**
 * Verify impersonation token. Throws jika invalid / bukan tipe impersonation.
 * @param {string} token
 * @param {object} cfg
 * @returns {object} Payload impersonation
 */
export function verifyImpersonationToken(token, cfg) {
    const payload = jwt.verify(token, cfg.jwtSecret, { issuer: ISSUER });
    if (payload.type !== "impersonation") {
        throw new Error("Bukan impersonation token");
    }
    return payload;
}

/**
 * Generate random secret (untuk setup ENV).
 * @param {number} [bytes]
 * @returns {string}
 */
export function randomSecret(bytes = 32) {
    return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Hitung TTL refresh token dalam ms dari expiresIn string.
 * @param {object} cfg
 * @returns {number}
 */
export function refreshTokenExpiryMs(cfg) {
    return msFromExpiresIn(cfg.jwtRefreshExpiresIn);
}

/**
 * Hitung TTL access token dalam detik dari expiresIn string.
 * @param {object} cfg
 * @returns {number}
 */
export function accessTokenTtlSeconds(cfg) {
    return Math.round(msFromExpiresIn(cfg.jwtExpiresIn) / 1000);
}

/** Parse "15m" | "7d" | "1h" | "30s" | <number> (detik) → ms */
function msFromExpiresIn(value) {
    if (typeof value === "number") {
        return value * 1000;
    }
    const match = String(value).trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
    if (!match) {
        return 15 * 60 * 1000; // fallback 15m
    }
    const amount = parseInt(match[1], 10);
    const unit = (match[2] || "s").toLowerCase();
    const multipliers = { ms: 1, s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return amount * multipliers[unit];
}

export default {
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
};
