/**
 * Kitchen Route — Chef / Kitchen (F&B V1).
 *
 * Chef melihat order F&B (meja, item, qty, catatan) dan mengubah status
 * kitchen: TERIMA (NEW→PREPARING) → PESANAN SIAP (PREPARING→READY).
 *
 *   GET  /api/kitchen/orders                  — daftar order aktif kitchen
 *                                              (new + preparing + ready)
 *   GET  /api/kitchen/orders/:id              — detail order
 *   POST /api/kitchen/orders/:id/status       — ubah status kitchen
 *
 * Permission: pos.kitchen.view (GET), pos.kitchen.update (POST status).
 * Role CHEF: hanya permission kitchen — TIDAK bisa settings/payment/void/
 * laporan (RBAC server-side).
 *
 * @module server/routes/kitchen
 */

import { Router } from "express";
import { TableOrder } from "../models/TableOrder.js";
import { Notification } from "../models/Notification.js";
import { security, audit } from "../security.js";
import { sendReadyNotification, sendCancelledNotification, sendItemsCancelledNotification } from "../services/kitchen-notify.js";
import { buildOrderCancelledNotification } from "../services/notification.js";
import { notifyOrderWhatsapp } from "../services/wa-notify.js";
import { cancelOrderItems } from "../services/order-cancel.js";

const router = Router();

/** Parse "YYYY-MM-DD" → Date lokal (server tz) pukul 00:00. null bila invalid. */
function parseDate(raw) {
    const m = String(raw || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
}

/** Simpan notifikasi bell KASIR (order dibatalkan) — best effort, TIDAK
 *  pernah menggagalkan pembatalan order. */
async function pushCancelledNotification(order) {
    try {
        const n = buildOrderCancelledNotification(order);
        await Notification.create({
            companyCode: order.companyCode,
            locationId: order.lokasiId || "",
            tableId: order.tableId || "",
            orderId: String(order._id),
            orderNumber: order.orderNumber || 0,
            nomorMeja: order.nomorMeja || "",
            targetRole: "cashier",
            type: "order_cancelled",
            title: n.title || "Order dibatalkan",
            message: n.message || "",
            payload: n.payload || {},
            read: false
        });
    } catch (err) {
        console.warn("[Kitchen] Gagal buat notifikasi kasir (order_cancelled):", err?.message);
    }
}

/**
 * GET /orders — daftar order kitchen (F&B M6-FIX: board + riwayat), terbaru dulu.
 * HANYA order yang mengandung item RECIPE / RECIPE-FNB (hasKitchenItems) —
 * order barang dagangan/jasa murni TIDAK masuk kitchen (F&B V1).
 *
 * Filter tanggal (permintaan user):
 *   ?today=1            → BOARD (default): HANYA order HARI INI (semua status).
 *                         Order dari tanggal sebelumnya — termasuk yang masih
 *                         aktif/belum selesai — TIDAK tampil di board, hanya
 *                         lewat tab Riwayat.
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD → RIWAYAT: rentang tanggal (semua status),
 *                         dipakai tab "Riwayat" + filter tanggal di halaman.
 *   tanpa keduanya      → perilaku lama: hanya order aktif (new/preparing/ready).
 *   ?status=new|preparing|ready → filter status spesifik (mode aktif saja).
 */
router.get("/orders", security.permission("pos.kitchen.view"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const q = { companyCode, hasKitchenItems: true };

        const todayFlag = String(req.query.today || "").trim();
        const fromRaw = String(req.query.from || "").trim();
        const toRaw = String(req.query.to || "").trim();
        const isToday = todayFlag === "1" || todayFlag === "true";
        const hasRange = Boolean(fromRaw || toRaw);

        if (isToday) {
            // BOARD (default): HANYA order yang dibuat hari ini (semua status).
            const startToday = new Date();
            startToday.setHours(0, 0, 0, 0);
            q.createdAt = { $gte: startToday };
        } else if (hasRange) {
            const range = {};
            const from = parseDate(fromRaw);
            const to = parseDate(toRaw);
            if (from) range.$gte = from;
            if (to) range.$lt = new Date(to.getTime() + 86400000);
            if (Object.keys(range).length) q.createdAt = range;
        } else {
            q.kitchenStatus = { $in: ["new", "preparing", "ready"] };
            // Filter status spesifik opsional: ?status=new|preparing|ready
            const status = String(req.query.status || "").trim().toLowerCase();
            if (["new", "preparing", "ready"].includes(status)) q.kitchenStatus = status;
        }

        const orders = await TableOrder.find(q)
            .sort({ orderNumber: -1 })
            .limit(300)
            .lean();
        res.json({ data: orders });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** GET /orders/:id — detail order kitchen (company scope). */
router.get("/orders/:id", security.permission("pos.kitchen.view"), async (req, res) => {
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
 * POST /orders/:id/status — ubah status kitchen (chef).
 * Body: { status: "preparing" | "ready" }
 *   TERIMA        → new → preparing
 *   PESANAN SIAP  → preparing → ready  (kirim web push customer)
 */
router.post("/orders/:id/status", security.permission("pos.kitchen.update"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const order = await TableOrder.findOne({ _id: req.params.id, companyCode });
        if (!order) return res.status(404).json({ error: "Order tidak ditemukan" });

        const target = String(req.body?.status || "").trim().toLowerCase();
        if (!["preparing", "ready"].includes(target)) {
            return res.status(400).json({ error: "Status kitchen tidak valid (pilih: preparing, ready)" });
        }
        const FLOW = { new: 0, preparing: 1, ready: 2 };
        const current = String(order.kitchenStatus || "new").toLowerCase();
        if (FLOW[target] <= FLOW[current]) {
            return res.status(409).json({ error: `Tidak bisa mengubah dari \"${current}\" ke \"${target}\" (status mundur)` });
        }

        const actor = req.headers["x-user-name"] || (req.user && req.user.name) || "Chef";
        order.kitchenStatus = target;
        if (target === "ready") {
            order.readyAt = new Date();
            order.readyBy = actor;
        }
        await order.save();

        if (target === "preparing") {
            // F&B V1 — WA customer "Pesanan sedang dikerjakan" saat kitchen
            // klik TERIMA (fire and forget).
            notifyOrderWhatsapp(order, "preparing").catch(err => {
                console.warn("[Kitchen] Gagal kirim WA pengerjaan:", err?.message);
            });
        }
        if (target === "ready") {
            sendReadyNotification(order).catch(err => {
                console.warn("[Kitchen] Gagal kirim notifikasi siap:", err?.message);
            });
            // F&B V1 — WA customer "Pesanan sudah siap" (fire and forget).
            notifyOrderWhatsapp(order, "ready").catch(err => {
                console.warn("[Kitchen] Gagal kirim WA siap:", err?.message);
            });
        }

        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Terapkan pembatalan (sebagian/seluruh) pada order — dipakai bersama oleh
 * POST /cancel-items (parsial) & POST /cancel (seluruh).
 *
 * Setelah item ditandai via cancelOrderItems:
 *   - SEMUA item dibatalkan  → order batal total (kitchenStatus=cancelled)
 *   - Semua item DAPUR habis dibatalkan (sisa barang dagangan/jasa) → dapur
 *     selesai → kitchenStatus=ready (disiapkan kasir, semantik order tanpa
 *     item resep)
 *   - Sebagian → order tetap jalan di status sekarang
 *
 * Bila payment SUDAH LUNAS → refundStatus=pending + refundAmount parsial
 * (subtotal item dibatalkan + pajak proporsional). Kasir memproses refund.
 *
 * Notifikasi: bell KASIR (order_cancelled) + web push CUSTOMER
 * (full → buildCancelledPayload; parsial → buildItemsCancelledPayload).
 * @returns {Promise<object|null>} Dokumen order tersimpan, atau null bila
 *          route harus mengakhiri response (sudah menulis 400/409/404).
 */
async function applyCancellation(req, res, order, itemIds, forceAll, actor, reason) {
    const effects = cancelOrderItems(order, itemIds, actor, reason, { forceAll });
    if (effects.marked === 0) {
        res.status(400).json({ error: "Tidak ada item yang valid untuk dibatalkan" });
        return null;
    }

    order.cancelledSubtotal = effects.cancelledSubtotal;
    if (effects.allCancelled) {
        order.kitchenStatus = "cancelled";
        order.cancelledAt = new Date();
        order.cancelledBy = actor;
        order.cancelReason = String(reason || "").slice(0, 300);
    } else if (effects.kitchenRemaining === 0) {
        // Semua item dapur dibatalkan — sisa barang dagangan disiapkan kasir.
        order.kitchenStatus = "ready";
        order.readyAt = new Date();
        order.readyBy = actor;
    }
    // Sudah LUNAS → kasir wajib refund (nominal = bagian yang dibatalkan).
    if (order.paymentStatus === "paid" && order.refundStatus !== "refunded") {
        order.refundStatus = "pending";
        order.refundAmount = effects.refundAmount;
    }
    await order.save();

    // 1) Bell KASIR — order/item dibatalkan (+ info refund bila lunas).
    await pushCancelledNotification(order);
    // 2) Web push CUSTOMER — fire and forget (tidak menggagalkan cancel).
    const push = effects.allCancelled ? sendCancelledNotification(order) : sendItemsCancelledNotification(order);
    push.catch(err => {
        console.warn("[Kitchen] Gagal kirim notifikasi pembatalan:", err?.message);
    });
    // 3) F&B V1 — WA CUSTOMER "Pesanan dibatalkan" / "Item dibatalkan".
    notifyOrderWhatsapp(order, effects.allCancelled ? "cancelled" : "items_cancelled").catch(err => {
        console.warn("[Kitchen] Gagal kirim WA pembatalan:", err?.message);
    });

    try {
        await audit.log({
            actorId: req.user?.id || null,
            actorName: actor,
            actorType: "user",
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || "",
            action: effects.allCancelled ? "order.cancelled" : "order.item_cancelled",
            category: "order",
            companyCode: order.companyCode,
            targetType: "order",
            targetId: String(order._id),
            targetName: order.orderId || "",
            itemsCancelled: effects.marked
        });
    } catch { /* audit best effort */ }

    return order;
}

/**
 * POST /orders/:id/cancel-items — BATALKAN ITEM TERTENTU (chef, F&B V1).
 *
 * Pembatalan PER-ITEM: chef menandai SATU ATAU BEBERAPA baris (itemId),
 * mis. 2 item dapur — item lain TETAP dibuat. Barang dagangan/jasa di luar
 * item dapur tidak ikut dibatalkan (kecuali dipilih chef).
 *
 * Body: { itemIds: string[], reason? } — itemIds = daftar itemId baris
 * (dari kitchenItems; item legacy tanpa itemId tidak bisa dibatalkan
 * per-item — gunakan /cancel untuk membatalkan seluruh order).
 *
 * Notifikasi & refund: sama dengan /cancel — bell kasir + push customer;
 * bila LUNAS → refund PARSIAL (nilai item dibatalkan + pajak proporsional).
 * Permission: pos.kitchen.update.
 */
router.post("/orders/:id/cancel-items", security.permission("pos.kitchen.update"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const order = await TableOrder.findOne({ _id: req.params.id, companyCode });
        if (!order) return res.status(404).json({ error: "Order tidak ditemukan" });

        const current = String(order.kitchenStatus || "new").toLowerCase();
        if (!["new", "preparing"].includes(current)) {
            return res.status(409).json({
                error: `Order berstatus \"${current}\" — hanya bisa dibatalkan sebelum siap (Baru / Dibuat)`
            });
        }
        const rawIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : [];
        if (rawIds.length === 0) {
            return res.status(400).json({ error: "Pilih minimal satu item untuk dibatalkan (itemIds)" });
        }
        const actor = req.headers["x-user-name"] || (req.user && req.user.name) || "Chef";
        const reason = String(req.body?.reason || "");
        const saved = await applyCancellation(req, res, order, rawIds, false, actor, reason);
        if (!saved) return;
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /orders/:id/cancel — BATALKAN SELURUH ORDER (chef, F&B V1).
 *
 * Hanya order yang belum SIAP (new/preparing). Semua item ditandai
 * dibatalkan (termasuk barang dagangan) — order batal total.
 *
 * Notifikasi:
 *   - KASIR (bell role cashier, type order_cancelled): bila order sudah
 *     LUNAS (paymentStatus=paid) → kasir WAJIB refund; belum lunas → info
 *     pembatalan biasa. Notifikasi TETAP dikirim dalam kedua kasus.
 *   - CUSTOMER (web push): "Pesanan Anda telah dibatalkan".
 *
 * Body opsional: { reason } catatan pembatalan (maks 300).
 * Permission: pos.kitchen.update (sama dengan TERIMA/SIAP).
 */
router.post("/orders/:id/cancel", security.permission("pos.kitchen.update"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const order = await TableOrder.findOne({ _id: req.params.id, companyCode });
        if (!order) return res.status(404).json({ error: "Order tidak ditemukan" });

        const current = String(order.kitchenStatus || "new").toLowerCase();
        if (!["new", "preparing"].includes(current)) {
            return res.status(409).json({
                error: `Order berstatus \"${current}\" — hanya bisa dibatalkan sebelum siap (Baru / Dibuat)`
            });
        }

        const actor = req.headers["x-user-name"] || (req.user && req.user.name) || "Chef";
        const reason = String(req.body?.reason || "");
        const saved = await applyCancellation(req, res, order, [], true, actor, reason);
        if (!saved) return;
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
