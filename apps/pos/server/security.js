/**
 * Security Wiring — SMART Inventory Server (SP-027 M3).
 *
 * Menghubungkan shared package @smart/security (packages/smart-security)
 * dengan model & resolver milik Inventory Server.
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
import { User } from "./models/User.js";
import { SuperAdmin } from "./models/SuperAdmin.js";
import { Permission } from "./models/Permission.js";

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
        // Superadmin TIDAK punya sesi di Inventory (platform-only) — kecuali
        // via alur impersonasi yang memakai token bertipe "user".
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

/** Fallback permission bawaan jika dokumen Permission belum tersedia. */
const FALLBACK_ROLE_PERMISSIONS = {
    superadmin: ["*"],
    owner: ["*"],
    admin: [
        "inventory.barang.update", "inventory.barang.create", "inventory.supplier.create",
        "inventory.supplier.update", "inventory.pembelian.approve", "inventory.stock.opname",
        "inventory.report.export"
    ],
    operator: ["inventory.barang.read", "inventory.barang.create", "inventory.pembelian.create", "inventory.stock.adjust"],
    // SP-029 M3 + PRD V1 — kasir: dashboard + kasir + katalog + customer +
    // riwayat transaksi + shift; TANPA akses ubah master.
    kasir: ["inventory.dashboard.view", "pos.kasir.use", "inventory.barang.read", "inventory.customer.read", "inventory.sales.read", "pos.shift.open", "pos.shift.close", "pos.transaction.hold"],
    supervisor: ["inventory.dashboard.view", "inventory.barang.read", "inventory.supplier.read", "inventory.pembelian.read", "inventory.report.view"]
};

/**
 * Resolver permission role dari collection Permission (server-side RBAC).
 * @param {string} role
 * @returns {Promise<string[]>}
 */
async function getRolePermissions(role) {
    if (!role) return [];
    if (role === "owner" || role === "superadmin") return ["*"];
    try {
        const doc = await Permission.findOne({ roleName: role }).lean();
        if (doc && Array.isArray(doc.permissions)) return doc.permissions;
    } catch {
        // fallback ke template bawaan
    }
    return FALLBACK_ROLE_PERMISSIONS[role] || [];
}

export const security = createMiddleware({
    cfg,
    RefreshToken,
    getUserById,
    getRolePermissions,
    expectedAudience: "inventory",
    audience: "inventory"
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
            { model: User, label: "User" },
            { model: SuperAdmin, label: "SuperAdmin" }
        ],
        rounds: cfg.bcryptRound
    });
}
