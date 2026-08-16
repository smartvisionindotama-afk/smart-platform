/**
 * Web Push Service — F&B Customer Ready Notification (V1).
 *
 * Mengirim notifikasi Web Push ke subscription customer saat chef menekan
 * PESANAN SIAP. Menggunakan package `web-push` (VAPID).
 *
 * VAPID keys dari ENV (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY /
 * VAPID_SUBJECT). Bila belum dikonfigurasi, keys di-generate sekali dan
 * disimpan ke file `vapid-keys.json` (dev fallback) — agar subscription
 * lama tetap valid antar restart server.
 *
 * NOTIFICATION SOUND: kemampuan suara/vibrate bergantung browser/OS.
 * Payload menyertakan body + vibrate + badge; jika browser menolak
 * notifikasi / silent mode / DND — ikuti capability OS/browser, jangan
 * membuat error (push gagal → ditangkap & di-log, order tetap jalan).
 *
 * PAYLOAD SIZE (F&B V1-FIX): Chrome/FCM membatasi payload plaintext ~4096
 * byte. Ikon/badge notifikasi memakai ikon PWA STATIS (/icons/icon-192.png)
 * — SEBELUMNYA memakai company.logo yang berupa data URI base64 (logo bisa
 * puluhan KB) → payload melewati batas → push service tolak 413 → notifikasi
 * TIDAK PERNAH tampil saat browser ditutup (halaman terbuka tetap tampil
 * karena polling memakai Notification lokal). fitPushPayload menjadi jaring
 * pengaman terakhir bila payload tetap membengkak di masa depan.
 *
 * @module pos/server/services/web-push
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import webpush from "web-push";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAPID_KEYS_FILE = path.resolve(__dirname, "../vapid-keys.json");

/** Ikon notifikasi push — aset STATIS kecil dari PWA (bukan logo data URI). */
export const PUSH_NOTIFICATION_ICON = "/icons/icon-192.png";

/**
 * Batas aman payload push plaintext (Chrome/FCM ~4096 byte). Di bawah 4096
 * agar sisa ruang untuk enkripsi/header dan toleransi lintas browser.
 */
export const PUSH_PAYLOAD_MAX_BYTES = 3800;

/**
 * Klasifikasi error status code push — dipakai sendPushToSubscription.
 * @param {number} [statusCode]
 * @returns {"delete"|"payload-too-large"|"retryable"}
 */
export function classifyPushError(statusCode) {
    // Endpoint/subscription TIDAK PERNAH bisa dipakai lagi: VAPID key mismatch
    // (401/400), key invalid (403), endpoint expired/dihapus (404/410).
    // Subscription harus dihapus agar tidak gagal selamanya — customer yang
    // kembali ke halaman order akan subscribe ulang (upsert server).
    if ([400, 401, 403, 404, 410].includes(statusCode)) return "delete";
    // Payload melebihi batas push service — bukan salah subscription; jangan
    // hapus, tapi log keras agar bug payload diperbaiki.
    if (statusCode === 413) return "payload-too-large";
    return "retryable";
}

/**
 * Jaring pengaman ukuran payload: bila payload melebihi batas push service,
 * field berat (icon/badge/sound) di-strip dulu, lalu speakText, lalu body —
 * title + data (deep-link) SELALU dipertahankan.
 * @param {string|object} payload
 * @returns {{ payload: string, stripped: boolean }}
 */
export function fitPushPayload(payload) {
    let text = typeof payload === "string" ? payload : JSON.stringify(payload);
    if (Buffer.byteLength(text, "utf-8") <= PUSH_PAYLOAD_MAX_BYTES) {
        return { payload: text, stripped: false };
    }
    try {
        const obj = JSON.parse(text);
        for (const field of ["icon", "badge", "sound"]) delete obj[field];
        text = JSON.stringify(obj);
        if (Buffer.byteLength(text, "utf-8") > PUSH_PAYLOAD_MAX_BYTES) {
            delete obj.speakText;
            text = JSON.stringify(obj);
        }
        if (Buffer.byteLength(text, "utf-8") > PUSH_PAYLOAD_MAX_BYTES) {
            delete obj.body;
            text = JSON.stringify(obj);
        }
        return { payload: text, stripped: true };
    } catch {
        // Bukan JSON → kirim apa adanya (payload ini bukan dari builder kami).
        return { payload: text, stripped: false };
    }
}

/**
 * Siapkan VAPID keys (ENV → file cache → generate). Idempotent.
 * @returns {{ publicKey: string, privateKey: string, subject: string }}
 */
export function ensureVapidKeys() {
    const envPublic = process.env.VAPID_PUBLIC_KEY;
    const envPrivate = process.env.VAPID_PRIVATE_KEY;
    const envSubject = process.env.VAPID_SUBJECT || "mailto:admin@e-profit.id";

    if (envPublic && envPrivate) {
        return { publicKey: envPublic, privateKey: envPrivate, subject: envSubject };
    }

    // Dev fallback: cache keys di file agar subscription tidak invalid
    // setelah server restart (tanpa file, setiap boot = keys baru).
    try {
        if (fs.existsSync(VAPID_KEYS_FILE)) {
            const cached = JSON.parse(fs.readFileSync(VAPID_KEYS_FILE, "utf-8"));
            if (cached && cached.publicKey && cached.privateKey) {
                return { publicKey: cached.publicKey, privateKey: cached.privateKey, subject: envSubject };
            }
        }
    } catch { /* file korup → generate ulang */ }

    const keys = webpush.generateVAPIDKeys();
    try {
        fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(keys, null, 2), "utf-8");
        console.warn("[WebPush] VAPID keys di-generate & disimpan ke vapid-keys.json (dev). Set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY untuk production.");
    } catch (err) {
        console.warn("[WebPush] Gagal menyimpan VAPID keys cache:", err?.message);
    }
    return { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: envSubject };
}

/** VAPID keys yang dipakai server (singleton). */
const VAPID = ensureVapidKeys();

/** Set detail VAPID utk web-push (panggil sekali). */
webpush.setVapidDetails(VAPID.subject, VAPID.publicKey, VAPID.privateKey);

/**
 * Public key VAPID — dipakai browser saat request permission + subscribe
 * (applicationServerKey). Dikirim via GET /api/push/public-key.
 * @returns {string}
 */
export function getVapidPublicKey() {
    return VAPID.publicKey;
}

/**
 * Payload notifikasi \"Pesanan siap\".
 * - body: pesan sesuai spek
 * - vibrate + badge: kemampuan per browser/OS (best effort)
 * - icon/badge = ikon PWA statis (bukan company.logo — logo data URI bisa
 *   puluhan KB dan membuat payload melewati batas 4KB push service)
 * - data.orderId: utk deep-link notificationclick
 * @param {object} order Dokumen TableOrder
 * @param {object} [_company] Dokumen Company (tidak dipakai utk payload —
 *        ikon memakai aset statis, bukan logo data URI)
 * @returns {string} JSON payload
 */
export function buildReadyPayload(order = {}, _company = {}) {
    return JSON.stringify({
        title: "Pesanan Anda sudah siap 🍽️",
        body: `Meja ${order.nomorMeja || "-"} · ${order.orderId || ""}\nSilakan mengambil pesanan di kasir.`,
        // F&B V1 — pesan SUARA utk speechSynthesis di service worker
        // (customer menerima suara walau browser ditutup).
        speakText: "Pesanan Anda sudah siap. Silakan mengambil pesanan di kasir.",
        icon: PUSH_NOTIFICATION_ICON,
        badge: PUSH_NOTIFICATION_ICON,
        vibrate: [200, 100, 200],
        data: {
            orderId: order._id ? String(order._id) : "",
            orderNumber: order.orderNumber || 0,
            nomorMeja: order.nomorMeja || "",
            // Deep-link: customer dibawa kembali ke status order-nya
            // (url relatif — di-resolve SW terhadap origin).
            url: order.qrIdentifier
                ? `/m/${order.qrIdentifier}?order=${order.orderToken || ""}`
                : ""
        }
    });
}

/**
 * Payload notifikasi HASIL VERIFIKASI PEMBAYARAN (Payment Proof V1).
 * Event dibedakan (acceptance §15):
 *   - approved: "Pembayaran Anda telah dikonfirmasi."
 *   - rejected: "Bukti pembayaran belum dapat diverifikasi — silakan upload
 *     kembali atau konfirmasi langsung ke kasir."
 * Deep-link sama dgn ready: /m/{qrIdentifier}?order={orderToken}.
 * @param {object} order Dokumen TableOrder
 * @param {object} [_company] Dokumen Company (tidak dipakai utk payload)
 * @param {"approved"|"rejected"} [event]
 * @returns {string} JSON payload
 */
export function buildPaymentPayload(order = {}, _company = {}, event = "approved") {
    const approved = event === "approved";
    return JSON.stringify({
        title: approved
            ? "Pembayaran Anda telah dikonfirmasi ✅"
            : "Bukti pembayaran perlu dicek kembali",
        body: approved
            ? `Meja ${order.nomorMeja || "-"} · ${order.orderId || ""}\nPembayaran telah diverifikasi kasir.`
            : `Meja ${order.nomorMeja || "-"} · ${order.orderId || ""}\nSilakan upload ulang bukti atau konfirmasi langsung ke kasir.`,
        // F&B V1 — pesan SUARA utk speechSynthesis di service worker.
        speakText: approved
            ? "Pembayaran Anda telah dikonfirmasi. Terima kasih."
            : "Bukti pembayaran belum dapat diverifikasi. Silakan upload ulang atau konfirmasi langsung ke kasir.",
        icon: PUSH_NOTIFICATION_ICON,
        badge: PUSH_NOTIFICATION_ICON,
        vibrate: approved ? [120, 60, 120] : [200, 100, 200],
        data: {
            orderId: order._id ? String(order._id) : "",
            orderNumber: order.orderNumber || 0,
            nomorMeja: order.nomorMeja || "",
            url: order.qrIdentifier
                ? `/m/${order.qrIdentifier}?order=${order.orderToken || ""}`
                : ""
        }
    });
}

/**
 * Payload notifikasi ORDER DIBATALKAN (Kitchen).
 * Customer diberi tahu bahwa pesanannya dibatalkan — bila sudah lunas,
 * informasikan bahwa pembayaran akan direfund oleh kasir.
 * @param {object} order Dokumen TableOrder (kitchenStatus=cancelled)
 * @param {object} [_company] Dokumen Company (tidak dipakai utk payload)
 * @returns {string} JSON payload
 */
export function buildCancelledPayload(order = {}, _company = {}) {
    const paid = order.paymentStatus === "paid";
    return JSON.stringify({
        title: "Pesanan Anda telah dibatalkan",
        body: paid
            ? `Meja ${order.nomorMeja || "-"} · ${order.orderId || ""}\nPembayaran Anda akan direfund oleh kasir.`
            : `Meja ${order.nomorMeja || "-"} · ${order.orderId || ""}\nPesanan dibatalkan oleh dapur. Silakan hubungi kasir bila perlu.`,
        speakText: "Pesanan Anda telah dibatalkan.",
        icon: PUSH_NOTIFICATION_ICON,
        badge: PUSH_NOTIFICATION_ICON,
        vibrate: [200, 100, 200],
        data: {
            orderId: order._id ? String(order._id) : "",
            orderNumber: order.orderNumber || 0,
            nomorMeja: order.nomorMeja || "",
            url: order.qrIdentifier
                ? `/m/${order.qrIdentifier}?order=${order.orderToken || ""}`
                : ""
        }
    });
}

/**
 * Payload notifikasi ITEM DIBATALKAN (Kitchen — pembatalan per-item).
 * Sebagian item order dibatalkan, sisanya tetap dibuat. Bila sudah lunas,
 * sebutkan nominal yang akan direfund (refund parsial).
 * @param {object} order Dokumen TableOrder (items sebagian cancelled)
 * @param {object} [_company] Dokumen Company (tidak dipakai utk payload)
 * @returns {string} JSON payload
 */
export function buildItemsCancelledPayload(order = {}, _company = {}) {
    const items = Array.isArray(order.items) ? order.items : [];
    const cancelledItems = items.filter(i => i && i.cancelled);
    const names = cancelledItems
        .map(i => `${Number(i.qty) || 0}× ${String(i.nama || "").trim()}`)
        .filter(Boolean)
        .join(", ");
    const paid = order.paymentStatus === "paid";
    const refundAmount = Number(order.refundAmount || 0);
    const body = `Meja ${order.nomorMeja || "-"} · ${order.orderId || ""}\n`
        + (names ? `Item dibatalkan: ${names}.` : "Sebagian item dibatalkan.")
        + (paid && refundAmount > 0
            ? `\nRefund Rp ${refundAmount.toLocaleString("id-ID")} akan diproses kasir.`
            : "");
    return JSON.stringify({
        title: "Beberapa item pesanan dibatalkan",
        body,
        speakText: "Beberapa item pesanan Anda telah dibatalkan.",
        icon: PUSH_NOTIFICATION_ICON,
        badge: PUSH_NOTIFICATION_ICON,
        vibrate: [200, 100, 200],
        data: {
            orderId: order._id ? String(order._id) : "",
            orderNumber: order.orderNumber || 0,
            nomorMeja: order.nomorMeja || "",
            url: order.qrIdentifier
                ? `/m/${order.qrIdentifier}?order=${order.orderToken || ""}`
                : ""
        }
    });
}

/**
 * Payload notifikasi PEMBAYARAN DIREFUND (Kasir — order dibatalkan & lunas).
 * @param {object} order Dokumen TableOrder (refundStatus=refunded)
 * @param {object} [_company] Dokumen Company (tidak dipakai utk payload)
 * @returns {string} JSON payload
 */
export function buildRefundPayload(order = {}, _company = {}) {
    const amount = Number(order.refundAmount || order.total || 0);
    return JSON.stringify({
        title: "Pembayaran telah direfund 💰",
        body: `Meja ${order.nomorMeja || "-"} · ${order.orderId || ""}\nSejumlah Rp ${amount.toLocaleString("id-ID")} telah dikembalikan.`,
        speakText: "Pembayaran Anda telah direfund oleh kasir.",
        icon: PUSH_NOTIFICATION_ICON,
        badge: PUSH_NOTIFICATION_ICON,
        vibrate: [200, 100, 200],
        data: {
            orderId: order._id ? String(order._id) : "",
            orderNumber: order.orderNumber || 0,
            nomorMeja: order.nomorMeja || "",
            url: order.qrIdentifier
                ? `/m/${order.qrIdentifier}?order=${order.orderToken || ""}`
                : ""
        }
    });
}

/**
 * Kirim web push ke satu subscription. Menangani error per-endpoint:
 *   - delete   (400/401/403/404/410): subscription TIDAK PERNAH bisa dipakai
 *     lagi (VAPID mismatch / key invalid / expired) → { delete: true } —
 *     dipangkas dari DB; customer yang kembali ke halaman order subscribe ulang.
 *   - payload-too-large (413): bukan salah subscription — { delete: false },
 *     log keras (fitPushPayload seharusnya sudah mencegah ini).
 *   - retryable (lainnya) → { delete: false } (di-log, tidak menghentikan order).
 * @param {object} sub Dokumen PushSubscription ({ endpoint, keys })
 * @param {string|object} payload JSON string (atau objek — akan di-stringify)
 * @returns {Promise<{ok: boolean, delete: boolean, statusCode?: number, tooLarge?: boolean}>}
 */
export async function sendPushToSubscription(sub, payload) {
    if (!sub || !sub.endpoint) return { ok: false, delete: false };
    const fit = fitPushPayload(payload);
    try {
        await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: {
                p256dh: (sub.keys && sub.keys.p256dh) || "",
                auth: (sub.keys && sub.keys.auth) || ""
            }
        }, fit.payload);
        return { ok: true, delete: false };
    } catch (err) {
        const statusCode = err && (err.statusCode || err.status);
        const kind = classifyPushError(statusCode);
        if (kind === "delete") {
            return { ok: false, delete: true, statusCode };
        }
        if (kind === "payload-too-large") {
            console.warn("[WebPush] Payload push terlalu besar (413) — fitPushPayload sudah strip icon/badge/sound, cek isi payload:", err && err.message ? err.message : err);
            return { ok: false, delete: false, statusCode, tooLarge: true };
        }
        console.warn("[WebPush] Gagal kirim push:", err && err.message ? err.message : err);
        return { ok: false, delete: false, statusCode };
    }
}

export default {
    ensureVapidKeys,
    getVapidPublicKey,
    buildReadyPayload,
    buildCancelledPayload,
    buildItemsCancelledPayload,
    buildRefundPayload,
    sendPushToSubscription
};
