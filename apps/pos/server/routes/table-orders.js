/**
 * Table Orders Route — Order Meja (kasir) + Kitchen (chef) (F&B V1).
 *
 * Endpoint:
 *   GET  /api/table-orders                    — daftar order (filter status)
 *   GET  /api/table-orders/:id                — detail order
 *   POST /api/table-orders/:id/confirm-pay    — KONFIRMASI BAYAR (PENDING→PAID)
 *   POST /api/table-orders/:id/kitchen        — ubah status kitchen
 *                                              (NEW→PREPARING→READY→SERVED/COLLECTED)
 *
 * Alur (F&B V1):
 *   - Customer create order (route publik qr-public.js) → kitchenStatus NEW,
 *     paymentStatus PENDING. Order MASUK KITCHEN tanpa menunggu payment.
 *   - Chef: TERIMA (NEW→PREPARING), PESANAN SIAP (PREPARING→READY).
 *     READY → kirim Web Push ke customer (subscription per order).
 *   - Kasir: KONFIRMASI BAYAR (PENDING→PAID) — simpan confirmed_by/at +
 *     confirmation_method=manual. Kasir/waiter juga bisa tandai SERVED.
 *
 * Permission:
 *   - GET list/detail        : pos.order.view (kasir/admin/owner) — chef juga
 *     perlu melihat order (pos.kitchen.view) via endpoint kitchen (routes/kitchen).
 *   - confirm-pay            : pos.order.confirm
 *   - kitchen                : pos.kitchen.update
 *
 * @module server/routes/table-orders
 */

import { Router } from "express";
import { TableOrder } from "../models/TableOrder.js";
import { security, audit } from "../security.js";
import { sendReadyNotification, sendRefundNotification } from "../services/kitchen-notify.js";
import { notifyOrderWhatsapp } from "../services/wa-notify.js";

const router = Router();

/**
 * GET / — daftar order meja (company scope).
 * Filter: ?status=all|pending|paid|ready|completed
 *   - pending   → paymentStatus=pending
 *   - paid      → paymentStatus=paid
 *   - ready     → kitchenStatus=ready (termasuk paid & unpaid)
 *   - completed → kitchenStatus in [served, collected]
 *   - all       → tanpa filter
 * Terbaru dulu. Hanya sampai 200 order (V1 — list ringan untuk kasir).
 */
router.get("/", security.permission("pos.order.view"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const q = { companyCode };
        const status = String(req.query.status || "all").trim().toLowerCase();
        if (status === "pending") q.paymentStatus = "pending";
        else if (status === "paid") q.paymentStatus = "paid";
        else if (status === "ready") q.kitchenStatus = "ready";
        else if (status === "completed") q.kitchenStatus = { $in: ["served", "collected"] };

        const orders = await TableOrder.find(q)
            .sort({ orderNumber: -1 })
            .limit(200)
            .lean();
        res.json({ data: orders });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** GET /:id — detail order (company scope). */
router.get("/:id", security.permission("pos.order.view"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const order = await TableOrder.findOne({ _id: req.params.id, companyCode }).lean();
        if (!order) return res.status(404).json({ error: "Order tidak ditemukan" });
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /:id/confirm-pay — KONFIRMASI BAYAR manual.
 * PENDING → PAID. Simpan confirmed_by, confirmed_at, confirmation_method=manual.
 * Order yang sudah PAID → 409 (idempotent: kasir klik dua kali tidak error?).
 * Keputusan: PAID berulang diizinkan (idempotent, tetap update timestamps).
 */
router.post("/:id/confirm-pay", security.permission("pos.order.confirm"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const order = await TableOrder.findOne({ _id: req.params.id, companyCode });
        if (!order) return res.status(404).json({ error: "Order tidak ditemukan" });
        if (String(order.kitchenStatus || "") === "cancelled") {
            return res.status(409).json({ error: "Order sudah dibatalkan — tidak bisa konfirmasi pembayaran" });
        }
        if (order.paymentStatus === "paid") {
            return res.json(order); // idempotent
        }
        const confirmedBy = req.headers["x-user-name"] || (req.user && req.user.name) || "Kasir";
        order.paymentStatus = "paid";
        order.confirmedBy = confirmedBy;
        order.confirmedAt = new Date();
        order.confirmationMethod = "manual";
        await order.save();
        // F&B V1 — WA customer "Pembayaran dikonfirmasi" (fire and forget).
        notifyOrderWhatsapp(order, "paid").catch(err => {
            console.warn("[TableOrder] Gagal kirim WA bayar:", err?.message);
        });
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /:id/kitchen — ubah status kitchen (chef / kasir).
 * Body: { status: "preparing" | "ready" | "served" | "collected" }
 * Transisi valid: new→preparing→ready→(served|collected). Backward tidak
 * diizinkan (V1) kecuali fix manual via DB.
 * Saat mencapai "ready": simpan ready_at/ready_by + KIRIM web push customer.
 * Permission: pos.kitchen.update.
 */
router.post("/:id/kitchen", security.permission("pos.kitchen.update"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const order = await TableOrder.findOne({ _id: req.params.id, companyCode });
        if (!order) return res.status(404).json({ error: "Order tidak ditemukan" });

        const target = String(req.body?.status || "").trim().toLowerCase();
        const VALID = ["preparing", "ready", "served", "collected"];
        if (!VALID.includes(target)) {
            return res.status(400).json({ error: `Status kitchen tidak valid (pilih: ${VALID.join(", ")})` });
        }

        const FLOW = { new: 0, preparing: 1, ready: 2, served: 3, collected: 3 };
        const current = String(order.kitchenStatus || "new").toLowerCase();
        if (FLOW[target] <= FLOW[current]) {
            return res.status(409).json({ error: `Tidak bisa mengubah dari \"${current}\" ke \"${target}\" (status mundur)` });
        }

        const actor = req.headers["x-user-name"] || (req.user && req.user.name) || "System";
        order.kitchenStatus = target;
        if (target === "ready") {
            order.readyAt = new Date();
            order.readyBy = actor;
        } else if (target === "served" || target === "collected") {
            order.servedAt = new Date();
            order.servedBy = actor;
        }
        await order.save();

        // PESANAN SIAP → notifikasi customer (web push) — fire and forget.
        // Tidak pernah menghentikan response bila push gagal.
        if (target === "ready") {
            sendReadyNotification(order).catch(err => {
                console.warn("[TableOrder] Gagal kirim notifikasi siap:", err?.message);
            });
            // F&B V1 — WA customer "Pesanan sudah siap" (fire and forget).
            notifyOrderWhatsapp(order, "ready").catch(err => {
                console.warn("[TableOrder] Gagal kirim WA siap:", err?.message);
            });
        }

        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /:id/refund — REFUND order dibatalkan & sudah lunas (kasir, F&B V1).
 *
 * Syarat: kitchenStatus=cancelled + paymentStatus=paid + refundStatus belum
 * "refunded". Order yang belum lunas TIDAK punya tombol refund (kasir tidak
 * perlu mengembalikan apa pun — notifikasi pembatalan tetap sudah dikirim).
 *
 * RefundAmount = total order (V1). Refund ini tercatat sebagai PENGURANG
 * nilai penjualan saat tutup shift (Shift.totalRefund) dan customer diberi
 * web push "Pembayaran telah direfund".
 * Permission: pos.order.confirm (kasir/admin/owner).
 */
router.post("/:id/refund", security.permission("pos.order.confirm"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const order = await TableOrder.findOne({ _id: req.params.id, companyCode });
        if (!order) return res.status(404).json({ error: "Order tidak ditemukan" });
        // Refund berlaku utk pembatalan SELURUH (kitchenStatus=cancelled) ATAU
        // SEBAGIAN (beberapa item ditandai cancelled).
        const hasCancelledItems = (Array.isArray(order.items) ? order.items : []).some(i => i && i.cancelled);
        if (String(order.kitchenStatus || "") !== "cancelled" && !hasCancelledItems) {
            return res.status(409).json({ error: "Order tidak berstatus dibatalkan — refund tidak berlaku" });
        }
        if (order.paymentStatus !== "paid") {
            return res.status(409).json({ error: "Order belum lunas — refund tidak diperlukan" });
        }
        if (order.refundStatus === "refunded") {
            return res.status(409).json({ error: "Refund sudah diproses untuk order ini" });
        }

        const actor = req.headers["x-user-name"] || (req.user && (req.user.name || req.user.username)) || "Kasir";
        const username = String(req.user?.username || "").trim()
            || String(req.headers["x-user-username"] || "").trim();
        order.refundStatus = "refunded";
        // RefundAmount sudah dihitung SERVER saat pembatalan (full = total
        // order; parsial = subtotal item dibatalkan + pajak proporsional).
        // Fallback total utk data lama yang belum sempat menghitung parsial.
        order.refundAmount = Number(order.refundAmount) || (Number(order.total) || 0);
        order.refundedAt = new Date();
        order.refundedBy = actor;
        order.refundedUsername = username;
        await order.save();

        // Web push CUSTOMER — fire and forget (tidak menggagalkan refund).
        sendRefundNotification(order).catch(err => {
            console.warn("[TableOrder] Gagal kirim notifikasi refund:", err?.message);
        });
        // F&B V1 — WA customer "Pembayaran direfund" (fire and forget).
        notifyOrderWhatsapp(order, "refunded").catch(err => {
            console.warn("[TableOrder] Gagal kirim WA refund:", err?.message);
        });

        try {
            await audit.log({
                actorId: req.user?.id || null,
                actorName: actor,
                actorType: "user",
                ip: req.ip || "",
                userAgent: req.headers["user-agent"] || "",
                action: "payment.refunded",
                category: "payment",
                companyCode,
                targetType: "order",
                targetId: String(order._id),
                targetName: order.orderId || "",
                amount: order.refundAmount
            });
        } catch { /* audit best effort */ }

        res.json({ ok: true, message: "Refund diproses — customer diberi notifikasi", order });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
