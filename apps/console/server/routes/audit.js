/**
 * Audit Log API Routes — riwayat keamanan & aktivitas super admin.
 *
 * Data berasal dari collection `security_auditlogs` (SP-027 M3): login,
 * logout, failed login, password change, role change, company switch,
 * dan aktivitas super admin (company/superadmin/app logo, dll).
 *
 * Sebelumnya halaman Activity Log memakai data MOCK statis — route ini
 * menyediakan data NYATA dari server.
 *
 * Proteksi sama seperti Monitoring Center: authenticate + requireSuperAdmin.
 *
 * Endpoint:
 *   GET /api/audit?page=1&limit=10&search=...   — list audit (terbaru dulu)
 *
 * @module console/server/routes/audit
 */

import { Router } from "express";
import { SecurityAuditLog } from "../models/SecurityAuditLog.js";
import { security } from "../security.js";

const router = Router();

/**
 * Escape regex metacharacters dari input user (mencegah regex injection/ReDoS).
 * @param {string} str
 * @returns {string}
 */
export function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Bangun filter pencarian audit log (fungsi murni — testable).
 * Search mencakup actorName, actorId, action, targetName, targetId.
 * @param {string} [rawSearch]
 * @returns {object} MongoDB query filter
 */
export function buildAuditQuery(rawSearch = "") {
    const search = String(rawSearch || "").trim();
    if (!search) return {};
    const escaped = escapeRegex(search);
    return {
        $or: [
            { actorName: { $regex: escaped, $options: "i" } },
            { actorId: { $regex: escaped, $options: "i" } },
            { action: { $regex: escaped, $options: "i" } },
            { targetName: { $regex: escaped, $options: "i" } },
            { targetId: { $regex: escaped, $options: "i" } }
        ]
    };
}

/**
 * Parse & clamp pagination dari query string (page ≥ 1, 1 ≤ limit ≤ 100).
 * @param {object} query req.query
 * @returns {{page: number, limit: number}}
 */
export function parseAuditPagination(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
    return { page, limit };
}

/** Proteksi: hanya Super Admin platform (M3 — tidak ada endpoint publik). */
router.use(security.authenticate, security.requireSuperAdmin);

/**
 * GET /api/audit
 * List audit log terbaru (desc) dengan search + pagination.
 */
router.get("/", async (req, res) => {
    try {
        const { page, limit } = parseAuditPagination(req.query);
        const query = buildAuditQuery(req.query.search);

        const total = await SecurityAuditLog.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await SecurityAuditLog.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        res.json({
            data,
            pagination: { page: Math.min(page, totalPages), limit, total, totalPages }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
