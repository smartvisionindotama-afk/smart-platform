/**
 * Payment Proofs Route (KASIR) — verifikasi bukti pembayaran (F&B V1).
 *
 * Endpoint (authenticated + company scope + permission pos.order.confirm):
 *   GET  /api/payment-proofs/pending         — bukti PENDING yang perlu diverifikasi
 *   GET  /api/payment-proofs/order/:orderId  — riwayat bukti satu order (dgn gambar)
 *   POST /api/payment-proofs/:id/approve     — APPROVE: PENDING → APPROVED,
 *                                              order PENDING → PAID (manual)
 *   POST /api/payment-proofs/:id/reject      — REJECT: PENDING → REJECTED,
 *                                              order TETAP PENDING (safety §13)
 *
 * Semua verifikasi dilakukan KASIR (verification_method MANUAL) — TIDAK ada
 * auto-verify / OCR / AI (do-not-overbuild §19). Customer menerima Web Push
 * hasil verifikasi (approved / rejected — event dibedakan §15).
 *
 * @module server/routes/payment-proofs
 */

import { Router } from "express";
import { PaymentProof } from "../models/PaymentProof.js";
import { TableOrder } from "../models/TableOrder.js";
import { Notification } from "../models/Notification.js";
import { security, audit } from "../security.js";
import { sendPaymentNotification } from "../services/payment-notify.js";
import { notifyOrderWhatsapp } from "../services/wa-notify.js";

const router = Router();

/** Audit helper — isi aktor dari req.user (token kasir). */
function auditMeta(req) {
    return {
        actorId: req.user?.id || null,
        actorName: req.user?.name || req.user?.username || "Kasir",
        actorType: "user",
        ip: req.ip || "",
        userAgent: req.headers["user-agent"] || ""
    };
}

/** Nama aktor (verifiedBy / confirmedBy) — header dulu, fallback token. */
function actorName(req) {
    return req.headers["x-user-name"] || (req.user && (req.user.name || req.user.username)) || "Kasir";
}

/** Tandai notifikasi kasir (payment_proof) terkait order sebagai dibaca. */
async function markOrderNotificationsRead(companyCode, orderId) {
    try {
        await Notification.updateMany(
            { companyCode, targetRole: "cashier", orderId: String(orderId), read: false },
            { $set: { read: true, readAt: new Date() } }
        );
    } catch { /* best effort */ }
}

/**
 * GET /pending — bukti PENDING (company scope) + info order utk verifikasi.
 * Kasir membuka bell → [LIHAT] → bukti ini + tombol TOLAK / KONFIRMASI BAYAR.
 */
router.get("/pending", security.permission("pos.order.confirm"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const proofs = await PaymentProof.find({ companyCode, status: "pending" })
            .sort({ createdAt: 1 })
            .limit(50)
            .lean();
        res.json({ data: proofs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /order/:orderId — riwayat bukti SATU order (dgn dataUri utk dilihat
 * kasir; history tidak pernah dihapus — audit §12). Company scope.
 */
router.get("/order/:orderId", security.permission("pos.order.confirm"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const proofs = await PaymentProof.find({
            companyCode,
            orderId: String(req.params.orderId)
        })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        res.json({ data: proofs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /:id/approve — KONFIRMASI BAYAR (bukti valid).
 * Payment Proof: PENDING → APPROVED (verified_by/at, method MANUAL).
 * Order: paymentStatus PENDING → PAID (confirmed_by/at, manual).
 * Customer: Web Push "Pembayaran Anda telah dikonfirmasi."
 */
router.post("/:id/approve", security.permission("pos.order.confirm"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const proof = await PaymentProof.findOne({ _id: req.params.id, companyCode });
        if (!proof) return res.status(404).json({ error: "Bukti pembayaran tidak ditemukan" });
        if (proof.status !== "pending") {
            return res.status(409).json({ error: `Bukti sudah berstatus ${proof.status.toUpperCase()}` });
        }

        const actor = actorName(req);
        const now = new Date();
        const order = await TableOrder.findOne({ _id: proof.orderId, companyCode });
        if (!order) return res.status(404).json({ error: "Order tidak ditemukan" });

        // Approve bukti + PAID order (manual — keputusan kasir, bukan otomatis).
        proof.status = "approved";
        proof.verifiedBy = actor;
        proof.verifiedAt = now;
        proof.verificationMethod = "manual";
        await proof.save();

        if (order.paymentStatus !== "paid") {
            order.paymentStatus = "paid";
            order.confirmedBy = actor;
            order.confirmedAt = now;
            order.confirmationMethod = "manual";
            await order.save();
        }

        await markOrderNotificationsRead(companyCode, proof.orderId);

        // Customer notification (web push) — fire and forget.
        sendPaymentNotification(order, "approved").catch(err => {
            console.warn("[PaymentProof] Gagal kirim notifikasi approved:", err?.message);
        });
        // F&B V1 — WA customer "Pembayaran dikonfirmasi" (fire and forget).
        notifyOrderWhatsapp(order, "paid").catch(err => {
            console.warn("[PaymentProof] Gagal kirim WA bayar:", err?.message);
        });

        try {
            await audit.log({
                ...auditMeta(req),
                action: "payment.proof_approved",
                category: "payment",
                companyCode,
                targetType: "order",
                targetId: String(order._id),
                targetName: order.orderId || ""
            });
        } catch { /* audit best effort */ }

        res.json({ ok: true, message: "Pembayaran dikonfirmasi — customer diberi notifikasi", order, proof });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /:id/reject — TOLAK bukti (tidak valid).
 * Payment Proof: PENDING → REJECTED (verified_by/at, method MANUAL).
 * Order: TETAP PENDING — upload bukti TIDAK otomatis melunasi (§13).
 * Customer: Web Push "Bukti pembayaran belum dapat diverifikasi..."
 * Body opsional: { reason } (catatan kasir, maks 300).
 */
router.post("/:id/reject", security.permission("pos.order.confirm"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const proof = await PaymentProof.findOne({ _id: req.params.id, companyCode });
        if (!proof) return res.status(404).json({ error: "Bukti pembayaran tidak ditemukan" });
        if (proof.status !== "pending") {
            return res.status(409).json({ error: `Bukti sudah berstatus ${proof.status.toUpperCase()}` });
        }

        const actor = actorName(req);
        proof.status = "rejected";
        proof.verifiedBy = actor;
        proof.verifiedAt = new Date();
        proof.verificationMethod = "manual";
        proof.rejectionReason = String(req.body?.reason || "").slice(0, 300);
        await proof.save();

        // Order TIDAK diubah (tetap pending) — safety §13.
        const order = await TableOrder.findOne({ _id: proof.orderId, companyCode }).lean();
        await markOrderNotificationsRead(companyCode, proof.orderId);

        if (order) {
            sendPaymentNotification(order, "rejected").catch(err => {
                console.warn("[PaymentProof] Gagal kirim notifikasi rejected:", err?.message);
            });
        }

        try {
            await audit.log({
                ...auditMeta(req),
                action: "payment.proof_rejected",
                category: "payment",
                companyCode,
                targetType: "order",
                targetId: proof.orderId,
                targetName: order && order.orderId ? order.orderId : proof.orderId
            });
        } catch { /* audit best effort */ }

        res.json({ ok: true, message: "Bukti ditolak — customer diberi notifikasi", proof });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
