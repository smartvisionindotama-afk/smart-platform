/**
 * Kitchen Notify Service — kirim Web Push ke customer (F&B V1).
 *
 * Event yang dikirim ke subscription customer (PushSubscription discope
 * companyCode + orderId — Order A → Customer A, tidak tertukar):
 *   - PESANAN SIAP      (chef: PREPARING→READY)   → buildReadyPayload
 *   - ORDER DIBATALKAN  (kitchen cancel)           → buildCancelledPayload
 *   - PEMBAYARAN REFUND (kasir refund order lunas) → buildRefundPayload
 *
 * Subscription yang sudah tidak valid (410/404) dihapus. Kegagalan push TIDAK
 * pernah menghentikan alur utama (fire and forget — dipanggil dengan .catch).
 *
 * @module pos/server/services/kitchen-notify
 */

import { PushSubscription } from "../models/PushSubscription.js";
import { Company } from "../models/Company.js";
import {
    sendPushToSubscription,
    buildReadyPayload,
    buildCancelledPayload,
    buildItemsCancelledPayload,
    buildRefundPayload
} from "./web-push.js";

/** Ambil branding company (logo) untuk payload — best effort. */
async function loadCompany(companyCode) {
    try {
        return await Company.findOne({ code: companyCode }).select("name logo").lean();
    } catch {
        return null;
    }
}

/**
 * Kirim payload push ke SEMUA subscription order. Subscription invalid
 * (410/404) dihapus.
 * @param {object} order Dokumen TableOrder
 * @param {(order, company) => string} buildPayload Builder payload
 * @returns {Promise<{sent: number, deleted: number, total: number}>}
 */
async function sendOrderPush(order, buildPayload) {
    if (!order || !order._id) return { sent: 0, deleted: 0, total: 0 };
    const subs = await PushSubscription.find({
        companyCode: order.companyCode,
        orderId: String(order._id)
    }).lean();
    // DIAGNOSTIK (F&B V1-FIX): 0 subscription = customer TIDAK akan menerima
    // apa pun walau browser ditutup. Penyebab umum: subscription dihapus
    // server (410/VAPID mismatch) atau auto-subscribe gagal di sisi customer
    // (browser tidak mendukung / permission tidak granted / push key berubah
    // antar restart server sebelum vapid-keys.json di-cache).
    if (subs.length === 0) {
        console.warn(`[WebPush] Order ${order.orderId || order._id} punya 0 push subscription — push TIDAK terkirim (customer tidak terikat browser).`);
    }
    const company = await loadCompany(order.companyCode);
    const payload = buildPayload(order, company);
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
    if (subs.length > 0 && sent === 0) {
        console.warn(`[WebPush] Order ${order.orderId || order._id}: SEMUA ${subs.length} push gagal terkirim (0/${subs.length}, ${deleted} subscription dihapus) — periksa VAPID keys / koneksi push service.`);
    }
    return { sent, deleted, total: subs.length };
}

/**
 * Kirim notifikasi "Pesanan Siap" ke semua subscription order.
 * @param {object} order Dokumen TableOrder (sudah kitchenStatus=ready)
 * @returns {Promise<{sent: number, deleted: number, total: number}>}
 */
export async function sendReadyNotification(order) {
    return sendOrderPush(order, buildReadyPayload);
}

/**
 * Kirim notifikasi "Pesanan Anda telah dibatalkan" ke subscription order.
 * @param {object} order Dokumen TableOrder (kitchenStatus=cancelled)
 * @returns {Promise<{sent: number, deleted: number, total: number}>}
 */
export async function sendCancelledNotification(order) {
    return sendOrderPush(order, buildCancelledPayload);
}

/**
 * Kirim notifikasi "Beberapa item pesanan dibatalkan" (pembatalan PER-ITEM).
 * @param {object} order Dokumen TableOrder (items sebagian cancelled)
 * @returns {Promise<{sent: number, deleted: number, total: number}>}
 */
export async function sendItemsCancelledNotification(order) {
    return sendOrderPush(order, buildItemsCancelledPayload);
}

/**
 * Kirim notifikasi "Pembayaran telah direfund" ke subscription order.
 * @param {object} order Dokumen TableOrder (refundStatus=refunded)
 * @returns {Promise<{sent: number, deleted: number, total: number}>}
 */
export async function sendRefundNotification(order) {
    return sendOrderPush(order, buildRefundPayload);
}

export default {
    sendReadyNotification,
    sendCancelledNotification,
    sendItemsCancelledNotification,
    sendRefundNotification
};
