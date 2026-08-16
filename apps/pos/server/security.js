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
import { Role } from "./models/Role.js";

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
        "inventory.report.export",
        // M6.2 — Recipe/BOM F&B (Admin/Owner; kasir TIDAK diberi)
        "pos.recipe.manage"
    ],
    operator: ["inventory.barang.read", "inventory.barang.create", "inventory.pembelian.create", "inventory.stock.adjust"],
    // SP-029 M3 + PRD V1 — kasir: dashboard + kasir + katalog + customer +
    // riwayat transaksi + shift; TANPA akses ubah master.
    kasir: ["inventory.dashboard.view", "pos.kasir.use", "inventory.barang.read", "inventory.customer.read", "inventory.sales.read", "pos.shift.open", "pos.shift.close", "pos.transaction.hold", "pos.order.view", "pos.order.confirm"],
    // F&B V1 — Chef: kitchen display saja (view + update status). TIDAK punya
    // akses settings/payment/void/laporan (RBAC server-side).
    chef: ["pos.kitchen.view", "pos.kitchen.update"],
    supervisor: ["inventory.dashboard.view", "inventory.barang.read", "inventory.supplier.read", "inventory.pembelian.read", "inventory.report.view"]
};

/**
 * Cache permission tree (semua role + level + permissions) — TTL 60 detik.
 * Role hierarchy (SP-027): user mewarisi permission dari SEMUA role dengan
 * level <= level role-nya (pola sama dengan Permission client — sync dari
 * /api/permissions/roles). Tanpa hierarchy, UI menampilkan bell/aksi yang
 * server TOLAK 403 (mis. operator lihat bell via inheritance, server tolak
 * karena operator sendiri tidak punya pos.order.view).
 */
let _permCache = null;
let _permCacheAt = 0;
const PERM_CACHE_TTL_MS = 60_000;

async function loadPermissionTree() {
    const now = Date.now();
    if (_permCache && now - _permCacheAt < PERM_CACHE_TTL_MS) return _permCache;
    const [roles, perms] = await Promise.all([
        Role.find({}).lean(),
        Permission.find({}).lean()
    ]);
    const permMap = {};
    for (const p of perms) permMap[p.roleName] = p.permissions || [];
    _permCache = roles.map(r => ({
        name: r.name,
        level: Number(r.level) || 0,
        permissions: permMap[r.name] || []
    }));
    _permCacheAt = now;
    return _permCache;
}

/**
 * Resolver permission role dari collection Permission + Role (server-side RBAC).
 *
 * Menerapkan ROLE-HIERARCHY yang sama dengan client: user mewarisi permission
 * dari semua role dengan level <= level role-nya. Contoh: chef (level 25)
 * mewarisi permission kasir (level 20) → pos.order.view dihitung via hierarki.
 *
 * Owner & superadmin: wildcard "*" (akses penuh).
 * @param {string} role
 * @returns {Promise<string[]>}
 */
async function getRolePermissions(role) {
    if (!role) return [];
    if (role === "owner" || role === "superadmin") return ["*"];
    try {
        const tree = await loadPermissionTree();
        const userRole = tree.find(r => r.name === role);
        if (userRole && userRole.permissions.includes("*")) return ["*"];
        if (userRole) {
            const merged = new Set();
            for (const r of tree) {
                if (r.level <= userRole.level) {
                    for (const p of r.permissions) merged.add(p);
                }
            }
            return [...merged];
        }
    } catch {
        // fallback ke template bawaan (mis. DB tidak siap saat boot)
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
