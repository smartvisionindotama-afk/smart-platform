/**
 * Security Wiring — SMART Console Server (SP-027 M3).
 *
 * Menghubungkan shared package @smart/security (packages/smart-security)
 * dengan model & resolver milik Console Server.
 */

import {
    securityConfig,
    createAuditLogger,
    createMiddleware,
    createAuthRateLimiter,
    createApiRateLimiter,
    securityHeaders,
    corsOriginsFromEnv,
    migratePlaintextPasswords
} from "../../../packages/smart-security/src/index.js";

import mongoose from "mongoose";
import { RefreshToken } from "./models/RefreshToken.js";
import { SecurityAuditLog } from "./models/SecurityAuditLog.js";
import { SuperAdmin } from "./models/SuperAdmin.js";
import { User } from "./models/User.js";

const cfg = securityConfig();

/** Audit logger keamanan (collection security_auditlogs). */
export const audit = createAuditLogger(SecurityAuditLog);

/**
 * Resolver user fresh saat refresh token — verifikasi akun masih ada & aktif.
 * @param {string} id Mongo _id
 * @param {string} type "user" | "superadmin"
 * @param {object} [claims] Klaim refresh token (untuk sesi non-DB seperti impersonasi)
 * @returns {Promise<object|null>}
 */
async function getUserById(id, type, claims = {}) {
    if (type === "superadmin") {
        const sa = await SuperAdmin.findById(id);
        if (!sa || sa.active === false) return null;
        return {
            id: sa._id,
            username: sa.username,
            name: sa.name,
            email: sa.email,
            role: "superadmin",
            companyCode: null
        };
    }
    // Sesi non-DB (mis. sub impersonasi seperti "PT-001-admin") — rekonstruksi
    // dari klaim token (role/companyCode) agar refresh tetap berjalan.
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return {
            id,
            username: claims.username || id,
            name: claims.name || id,
            email: "",
            role: claims.role || "user",
            companyCode: claims.companyCode || null
        };
    }
    const user = await User.findById(id);
    if (!user || user.active === false) return null;
    return {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        companyCode: user.companyCode || null
    };
}

/** Resolver permission — superadmin platform punya akses penuh. */
async function getRolePermissions() {
    return ["*"];
}

export const security = createMiddleware({
    cfg,
    RefreshToken,
    getUserById,
    getRolePermissions,
    expectedAudience: "console",
    audience: "console"
});

/** Rate limiters (auth ketat, api umum). */
export const authLimiter = createAuthRateLimiter(cfg);
export const apiLimiter = createApiRateLimiter(cfg);

/** Security headers (helmet). */
export const helmetHeaders = securityHeaders();

/** Origin CORS dari ENV, fallback ke daftar development. */
export const corsOrigins = corsOriginsFromEnv(process.env, [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://101.50.2.10:5173",
    /^http:\/\/192\.168\./,
    /^http:\/\/10\./,
    /^https:\/\/.*\.e-profit\.id$/
]);

/** Migrasi password plaintext → bcrypt (idempotent). */
export function migratePasswords() {
    return migratePlaintextPasswords({
        models: [
            { model: SuperAdmin, label: "SuperAdmin" },
            { model: User, label: "User" }
        ],
        rounds: cfg.bcryptRound
    });
}
