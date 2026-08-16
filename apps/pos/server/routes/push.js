/**
 * Push Route — Web Push (F&B V1).
 *
 *   GET  /api/push/public-key    — VAPID public key (browser subscribe)
 *   POST /api/push/subscribe     — simpan subscription utk sebuah order
 *
 * POST /subscribe body:
 *   { orderToken, subscription: { endpoint, keys: { p256dh, auth } } }
 *
 * Validasi: orderToken harus milik order yang valid (TableOrder) — server
 * menautkan subscription ke order tersebut. Order A tidak menerima
 * notifikasi Order B (subscription discope orderId).
 *
 * Endpoint publik (tidak butuh login) — index.js PUBLIC_RULES.
 *
 * @module server/routes/push
 */

import { Router } from "express";
import { TableOrder } from "../models/TableOrder.js";
import { PushSubscription } from "../models/PushSubscription.js";
import { getVapidPublicKey } from "../services/web-push.js";

const router = Router();

/** GET /public-key — VAPID public key. */
router.get("/public-key", (req, res) => {
    res.json({ publicKey: getVapidPublicKey() });
});

/** POST /subscribe — simpan subscription utk order customer. */
router.post("/subscribe", async (req, res) => {
    try {
        const orderToken = String(req.body?.orderToken || "").trim();
        const sub = req.body?.subscription;
        if (!orderToken) return res.status(400).json({ error: "orderToken wajib diisi" });
        if (!sub || !sub.endpoint) {
            return res.status(400).json({ error: "subscription (endpoint) wajib diisi" });
        }
        if (String(sub.endpoint).length > 1000) {
            return res.status(400).json({ error: "Endpoint subscription terlalu panjang" });
        }

        // Resolve order dari token — order HARUS ada & valid.
        const order = await TableOrder.findOne({ orderToken }).select("companyCode _id orderId orderNumber nomorMeja kitchenStatus").lean();
        if (!order) {
            return res.status(404).json({ error: "Order tidak ditemukan — token tidak valid" });
        }

        // Upsert subscription per (company, ORDER, endpoint) — browser yang sama
        // boleh subscribe untuk BANYAK order: order baru menambah binding, order
        // lama tidak hilang. Sebelumnya key {company, endpoint} membuat satu
        // browser hanya terikat SATU order → order berikutnya di browser yang
        // sama 0 subscription → push tidak terkirim.
        const saved = await PushSubscription.findOneAndUpdate(
            { companyCode: order.companyCode, orderId: String(order._id), endpoint: sub.endpoint },
            {
                $set: {
                    orderId: String(order._id),
                    orderToken,
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: String(sub.keys?.p256dh || ""),
                        auth: String(sub.keys?.auth || "")
                    },
                    userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
                    lastError: ""
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(201).json({
            ok: true,
            orderId: order.orderId,
            kitchenStatus: order.kitchenStatus,
            subscriptionId: String(saved._id)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
