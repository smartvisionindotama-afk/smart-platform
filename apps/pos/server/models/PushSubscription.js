/**
 * PushSubscription Model — Web Push subscription customer (F&B V1).
 *
 * Customer yang membuat order dapat mengaktifkan notifikasi \"pesanan siap\"
 * TANPA login/nomor HP: subscription browser dihubungkan dengan order
 * (orderId + orderToken). Saat chef menekan PESANAN SIAP, backend mengirim
 * web push ke SEMUA subscription order tersebut — Order A → Customer A,
 * Order B → Customer B (tidak tertukar).
 *
 * `endpoint` di-unique per company agar subscription yang sama tidak
 * terduplikasi (browser re-subscribe → replace).
 *
 * @module server/models/PushSubscription
 */

import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema({
    companyCode: { type: String, required: true, index: true },
    // Referensi order (TableOrder._id) — subscription TERIKAT order.
    orderId:     { type: String, required: true, index: true },
    orderToken:  { type: String, required: true },
    endpoint:    { type: String, required: true },
    // Kunci enkripsi Web Push (p256dh + auth).
    keys: {
        p256dh: { type: String, default: "" },
        auth:   { type: String, default: "" }
    },
    // Identitas perangkat/browser utk display (opsional).
    userAgent:   { type: String, default: "" },
    // Subscription dihapus bila endpoint sudah tidak valid (410/404).
    lastError:   { type: String, default: "" }
}, { timestamps: true });

// Satu endpoint per company PER ORDER unik. Browser yang sama boleh
// subscribe untuk BANYAK order (customer memesan lagi di browser yang
// sama → order baru ikut terdaftar, order lama TIDAK kehilangan binding).
// Sebelumnya index {companyCode, endpoint} membuat satu browser hanya bisa
// terikat SATU order → order berikutnya di browser yang sama 0 subscription
// → push tidak pernah terkirim. Legacy index lama DI-DROP oleh
// ensurePushIndexes() (dipanggil saat server start — idempotent).
pushSubscriptionSchema.index({ companyCode: 1, orderId: 1, endpoint: 1 }, { unique: true });

export const PushSubscription = mongoose.model("PushSubscription", pushSubscriptionSchema);

/**
 * Migration idempotent — drop legacy unique index {companyCode, endpoint}
 * bila masih ada di produksi. Index lama membuat browser yang sama hanya
 * bisa terikat SATU order: order berikutnya di browser yang sama gagal
 * subscribe (E11000 duplicate key pada index lama) → order tsb 0
 * subscription → push tidak pernah terkirim.
 *
 * Dipanggil di server/index.js start() SETELAH connectDB (collection belum
 * tentu ada saat model di-import). Aman diulang; kegagalan hanya di-log.
 * @returns {Promise<void>}
 */
export async function ensurePushIndexes() {
    try {
        const col = PushSubscription.collection;
        let indexes = [];
        try {
            indexes = await col.indexes();
        } catch { /* collection belum ada — tidak ada index legacy */ }
        const legacy = indexes.find(i => i.name === "companyCode_1_endpoint_1");
        if (legacy) {
            await col.dropIndex("companyCode_1_endpoint_1");
            console.warn("[PushSubscription] Legacy unique index companyCode_1_endpoint_1 di-drop — browser kini bisa terikat banyak order.");
        }
        // Pastikan index baru ada (idempotent — mongoose autoIndex juga membuatnya).
        await col.createIndex({ companyCode: 1, orderId: 1, endpoint: 1 }, { unique: true });
    } catch (err) {
        console.warn("[PushSubscription] ensurePushIndexes gagal:", err && err.message ? err.message : err);
    }
}
