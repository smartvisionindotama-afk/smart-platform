/**
 * Payment Notify Service — Web Push hasil verifikasi pembayaran (F&B V1).
 *
 * Saat kasir APPROVE / REJECT bukti pembayaran, backend mengirim Web Push ke
 * SEMUA subscription customer order tersebut (pola sama dengan
 * kitchen-notify — PushSubscription discope companyCode + orderId).
 *
 * Event dibedakan (acceptance §15):
 *   - approved: "Pembayaran Anda telah dikonfirmasi."
 *   - rejected: "Bukti pembayaran belum dapat diverifikasi. Silakan upload
 *     kembali atau konfirmasi langsung ke kasir."
 *
 * Kegagalan push TIDAK menghentikan verifikasi (fire and forget — dipanggil
 * dengan .catch di route).
 *
 * @module pos/server/services/payment-notify
 */

import { PushSubscription } from "../models/PushSubscription.js";
import { Company } from "../models/Company.js";
import { sendPushToSubscription, buildPaymentPayload } from "./web-push.js";

/**
 * Kirim notifikasi hasil verifikasi pembayaran ke subscription order.
 * @param {object} order Dokumen TableOrder
 * @param {"approved"|"rejected"} event
 * @returns {Promise<{sent: number, deleted: number, total: number}>}
 */
export async function sendPaymentNotification(order, event) {
    if (!order || !order._id) return { sent: 0, deleted: 0, total: 0 };
    if (!["approved", "rejected"].includes(event)) event = "approved";
    const subs = await PushSubscription.find({
        companyCode: order.companyCode,
        orderId: String(order._id)
    }).lean();

    let company = null;
    try {
        company = await Company.findOne({ code: order.companyCode }).select("name logo").lean();
    } catch { /* payload tetap terkirim tanpa branding */ }

    const payload = buildPaymentPayload(order, company, event);
    let sent = 0;
    let deleted = 0;
    for (const sub of subs) {
        const res = await sendPushToSubscription(sub, payload);
        if (res.ok) sent++;
        if (res.delete) {
            deleted++;
            try {
                await PushSubscription.deleteOne({ _id: sub._id });
            } catch { /* ignore */ }
        }
    }
    return { sent, deleted, total: subs.length };
}

export default { sendPaymentNotification };
