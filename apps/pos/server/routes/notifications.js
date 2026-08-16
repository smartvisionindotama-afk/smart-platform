/**
 * Notifications Route — Role-Based Notification Bell (F&B V1).
 *
 * Endpoint (authenticated + company scope):
 *   GET  /api/notifications?role=cashier|kitchen&unread=1 — daftar notifikasi
 *   POST /api/notifications/:id/read                        — tandai SATU dibaca
 *   POST /api/notifications/read-all?role=cashier|kitchen   — tandai SEMUA dibaca
 *
 * ROLE SEPARATION (§4): bell memfilter berdasarkan `targetRole` dan user
 * HANYA bisa membaca notifikasi untuk role yang permission-nya dimiliki:
 *   - role=kitchen  → wajib pos.kitchen.view  (chef)
 *   - role=cashier  → wajib pos.order.view    (kasir/admin/owner)
 * User TIDAK bisa menandai dibaca notifikasi role lain (dicek targetRole).
 *
 * Event tersimpan penuh (§10): notification_id, company_id, order_id,
 * table_id (opsional), target_role, type, title, message, created_at, read_at.
 * Realtime: memakai mekanisme existing (polling 15 detik — tidak ada WS di
 * platform ini; polling ini ringan, bukan aggressive).
 *
 * @module server/routes/notifications
 */

import { Router } from "express";
import { Notification } from "../models/Notification.js";
import { security } from "../security.js";

const router = Router();

/**
 * Permission utk sebuah role bell:
 *   kitchen → pos.kitchen.view, cashier → pos.order.view
 * @param {object} req
 * @param {string} role
 * @returns {Promise<string|null>} Permission yang dibutuhkan atau null bila role tidak dikenal
 */
async function requiredPermissionForRole(req, role) {
    if (role === "kitchen") return "pos.kitchen.view";
    if (role === "cashier") return "pos.order.view";
    return null;
}

/**
 * GET / — daftar notifikasi (company scope + targetRole).
 * Query: ?role=cashier|kitchen (wajib), ?unread=1 → hanya belum dibaca.
 * Limit 50 (V1 — daftar ringan untuk bell).
 */
router.get("/", async (req, res, next) => {
    const role = String(req.query.role || "").trim().toLowerCase();
    const required = await requiredPermissionForRole(req, role);
    if (!required) {
        return res.status(400).json({ error: "Parameter role wajib diisi (cashier | kitchen)" });
    }
    return security.permission(required)(req, res, next);
}, async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const role = String(req.query.role || "").trim().toLowerCase();
        const q = { companyCode, targetRole: role };
        if (String(req.query.unread || "").trim() === "1") q.read = false;
        const data = await Notification.find(q)
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /:id/read — tandai SATU notifikasi dibaca.
 * User hanya bisa menandai notifikasi yang targetRole-nya sesuai permission
 * (kitchen → pos.kitchen.view; cashier → pos.order.view).
 * Chain: resolve notifikasi → cek permission role → update.
 */
router.post("/:id/read", async (req, res, next) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const item = await Notification.findOne({ _id: req.params.id, companyCode });
        if (!item) return res.status(404).json({ error: "Notifikasi tidak ditemukan" });
        req._notifTargetRole = item.targetRole;
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}, async (req, res, next) => {
    const required = await requiredPermissionForRole(req, req._notifTargetRole);
    if (!required) return res.status(403).json({ error: "Forbidden — role notifikasi tidak dikenal" });
    return security.permission(required)(req, res, next);
}, async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const updated = await Notification.findOneAndUpdate(
            { _id: req.params.id, companyCode, read: false },
            { $set: { read: true, readAt: new Date() } },
            { new: true }
        );
        if (!updated) return res.status(409).json({ error: "Notifikasi sudah dibaca" });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /read-all?role= — tandai SEMUA notifikasi (company + role) dibaca.
 */
router.post("/read-all", async (req, res, next) => {
    const role = String(req.query.role || "").trim().toLowerCase();
    const required = await requiredPermissionForRole(req, role);
    if (!required) {
        return res.status(400).json({ error: "Parameter role wajib diisi (cashier | kitchen)" });
    }
    return security.permission(required)(req, res, next);
}, async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const role = String(req.query.role || "").trim().toLowerCase();
        const result = await Notification.updateMany(
            { companyCode, targetRole: role, read: false },
            { $set: { read: true, readAt: new Date() } }
        );
        res.json({ ok: true, updated: result.modifiedCount || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
