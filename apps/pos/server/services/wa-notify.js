/**
 * WA Notify Service — notifikasi status order via WhatsApp (Sidobe gateway).
 *
 * Gateway: https://api.sidobe.com/wa/v1/send-message
 *   - Header  : X-Secret-Key: <secret>  (dari dashboard Sidobe → Developer Tools
 *              → Credential; set ENV SIDOBE_SECRET_KEY)
 *   - Body    : { phone: "+628xxxx" (E.164), message, is_async: true }
 *
 * Event yang dikirim ke customer (nomor WA tersimpan di TableOrder
 * .customerWhatsapp — diisi customer saat checkout):
 *   - received        → "Pesanan Anda diterima"   (order dibuat)
 *   - preparing       → "Pesanan sedang dikerjakan" (kitchen TERIMA)
 *   - ready           → "Pesanan sudah siap"      (kitchen READY)
 *   - paid            → "Pembayaran dikonfirmasi" (kasir / verifikasi bukti)
 *   - cancelled       → "Pesanan dibatalkan"      (kitchen cancel seluruh)
 *   - items_cancelled → "Sebagian item dibatalkan"
 *   - refunded        → "Pembayaran direfund"
 *
 * WA adalah SALURAN PRIMER (pengganti Web Push yang tidak andal di sebagian
 * HP). Kegagalan TIDAK pernah menghentikan alur order (fire and forget).
 *
 * Konfigurasi gateway diambil dari Settings → Konfigurasi WA (per-company,
 * field Company.waProviderUrl/waSecretKey/waSenderNumber — diatur admin
 * POS). Bila company belum mengisi → fallback env SIDOBE_SECRET_KEY /
 * SIDOBE_BASE_URL (provider default https://api.sidobe.com/wa/v1).
 *
 * @module pos/server/services/wa-notify
 */

import { Company } from "../models/Company.js";
import { BankAccount } from "../models/BankAccount.js";

/** Provider default (bila company/env tidak mengatur URL). */
export const DEFAULT_WA_PROVIDER_URL = "https://api.sidobe.com/wa/v1/send-message";

/**
 * Normalisasi provider URL → base endpoint (tanpa /send-message di akhir).
 * Pure — testable.
 * @param {string} raw URL penuh (mis. .../wa/v1/send-message) atau kosong
 * @returns {string} base URL (tanpa trailing slash)
 */
export function normalizeProviderBase(raw) {
    const s = String(raw || "").trim();
    if (!s) return DEFAULT_WA_PROVIDER_URL.replace(/\/send-message$/, "");
    return s.replace(/\/send-message\/?$/, "").replace(/\/$/, "");
}

/**
 * Muat konfigurasi WA gateway company (best effort).
 * Hasilnya langsung bentuk cfg `sendWaText` ({ providerUrl, secretKey,
 * senderNumber }) — memetakan field Company (waProviderUrl/waSecretKey/
 * waSenderNumber) ke bentuk API.
 * @param {string} companyCode
 * @returns {Promise<{providerUrl: string, secretKey: string, senderNumber: string}>}
 */
export async function loadWaConfig(companyCode) {
    try {
        const company = await Company.findOne({ code: companyCode })
            .select("waProviderUrl waSecretKey waSenderNumber")
            .lean();
        if (!company) return {};
        return {
            providerUrl: String(company.waProviderUrl || ""),
            secretKey: String(company.waSecretKey || ""),
            senderNumber: String(company.waSenderNumber || "")
        };
    } catch (err) {
        console.warn("[WaNotify] Gagal muat konfigurasi WA company:", err?.message);
        return {};
    }
}

/** Normalisasi nomor HP → E.164 "+628..." (format Sidobe). Pure. */
export function normalizeWaPhone(raw) {
    if (!raw) return "";
    const digits = String(raw).replace(/[^\d]/g, "");
    if (!digits) return "";
    if (digits.startsWith("0")) return "+62" + digits.slice(1);
    if (digits.startsWith("8")) return "+62" + digits;
    return "+" + digits;
}

/** Label meja tanpa awalan "Meja" ganda (pure). */
export function normalizeMejaLabel(raw) {
    if (!raw) return "-";
    const s = String(raw).trim();
    return s.replace(/^meja\s*/i, "") || s;
}

/** URL status order (deep-link customer) — dipakai di pesan "diterima". */
export function statusUrlOf(order = {}) {
    if (!order.qrIdentifier || !order.orderToken) return "";
    const base = String(process.env.POS_BASE_URL || "https://pos.e-profit.id").replace(/\/$/, "");
    return `${base}/m/${order.qrIdentifier}?order=${order.orderToken}`;
}

function rupiah(n) {
    return "Rp " + (Number(n) || 0).toLocaleString("id-ID");
}

/**
 * Muat rekening bank AKTIF company (Settings → Payment Settings) — dipakai
 * pesan "received" utk instruksi transfer. Best effort.
 * @param {string} companyCode
 * @returns {Promise<Array<{bankName: string, accountNumber: string, accountName: string}>>}
 */
export async function loadBankAccounts(companyCode) {
    try {
        return await BankAccount.find({ companyCode, active: true })
            .select("bankName accountNumber accountName")
            .sort({ createdAt: 1 })
            .lean();
    } catch (err) {
        console.warn("[WaNotify] Gagal muat rekening bank:", err?.message);
        return [];
    }
}

/**
 * Bangun pesan WA per event (pure — testable).
 * @param {object} order Dokumen TableOrder
 * @param {"received"|"ready"|"paid"|"cancelled"|"items_cancelled"|"refunded"|""} event
 * @param {object} [opts] Opsional: { bankAccounts: [{bankName, accountNumber, accountName}] }
 * @returns {string} "" bila event tidak dikenal
 */
export function buildWaOrderMessage(order = {}, event = "", opts = {}) {
    const meja = normalizeMejaLabel(order.nomorMeja);
    const ref = order.orderId || "";
    const total = rupiah(order.total);
    switch (event) {
        case "received": {
            // Rekening AKTIF dari Settings → Payment Settings → Bank Account.
            // Kosong → fallback instruksi umum (tanpa daftar rekening).
            const bankAccounts = Array.isArray(opts.bankAccounts) ? opts.bankAccounts : [];
            const bankLines = bankAccounts
                .map(b => `   - ${String(b.bankName || "").trim()}: ${String(b.accountNumber || "").trim()} a.n. ${String(b.accountName || "").trim()}`)
                .filter(Boolean);
            // Baris kosong ("") DIPERTAHANKAN — jangan filter: spasi setelah
            // Total + sebelum bukti pembayaran. Tanpa link status di sini
            // (link pindah ke pesan "paid").
            return [
                "✅ Pesanan Anda telah diterima!",
                `Meja: ${meja}`,
                `Order: ${ref}`,
                `Total: ${total}`,
                "",
                "Silahkan lakukan pembayaran dengan cara:",
                "a. Bayar tunai di kasir",
                "b. Scan QRIS yang ada di meja",
                bankLines.length
                    ? ["c. Transfer pada rekening berikut:", ...bankLines].join("\n")
                    : "c. Transfer pada rekening yang tersedia di meja",
                "",
                "Setelah pembayaran, silakan kirim bukti scan/transfer di chat ini."
            ].join("\n");
        }
        case "preparing":
            return [
                "👨‍🍳 Pesanan Anda sedang dalam pengerjaan!",
                `Meja: ${meja} · ${ref}`,
                "Silakan menunggu — kami kabari lagi saat pesanan sudah siap.",
                statusUrlOf(order) ? `\nLihat status: ${statusUrlOf(order)}` : ""
            ].filter(Boolean).join("\n");
        case "ready":
            return [
                "🎉 Pesanan Anda sudah siap!",
                `Meja: ${meja} · ${ref}`,
                "Silakan mengambil pesanan di kasir.",
                statusUrlOf(order) ? `\nLihat status: ${statusUrlOf(order)}` : ""
            ].filter(Boolean).join("\n");
        case "paid":
            return [
                "✅ Pembayaran Anda telah dikonfirmasi.",
                `${ref} · Total ${total}`,
                "Terima kasih 🙏",
                // Link status pindah ke sini (permintaan user): di bawah pesan
                // pembayaran dikonfirmasi.
                statusUrlOf(order) ? `\nLihat status: ${statusUrlOf(order)}` : ""
            ].filter(Boolean).join("\n");
        case "cancelled": {
            const paid = order.paymentStatus === "paid";
            return [
                "❌ Pesanan Anda telah dibatalkan.",
                `Meja: ${meja} · ${ref}`,
                paid ? `Pembayaran ${total} akan direfund oleh kasir.` : "Silakan hubungi kasir bila perlu."
            ].join("\n");
        }
        case "items_cancelled": {
            const items = Array.isArray(order.items) ? order.items : [];
            const names = items
                .filter(i => i && i.cancelled)
                .map(i => `${Number(i.qty) || 0}× ${String(i.nama || "").trim()}`)
                .filter(Boolean)
                .join(", ");
            const refundAmount = Number(order.refundAmount) || 0;
            return [
                "🗑️ Beberapa item pesanan Anda dibatalkan.",
                `${ref}${names ? ` · ${names}` : ""}`,
                (order.paymentStatus === "paid" && refundAmount > 0)
                    ? `Refund ${rupiah(refundAmount)} akan diproses kasir.`
                    : "Silakan hubungi kasir bila perlu."
            ].join("\n");
        }
        case "refunded": {
            const amount = Number(order.refundAmount || order.total || 0);
            return [
                "💰 Pembayaran Anda telah direfund.",
                `${ref} · ${rupiah(amount)}`
            ].join("\n");
        }
        default:
            return "";
    }
}

/**
 * Kirim pesan teks WA via Sidobe. TIDAK pernah throw — gagal hanya di-log.
 * @param {string} phone Nomor HP customer (format bebas — dinormalisasi)
 * @param {string} message Isi pesan
 * @param {object} [cfg] Konfigurasi gateway (per-company / override env):
 *        { providerUrl, secretKey, senderNumber }
 * @returns {Promise<{ok: boolean, error?: string, status?: number}>}
 */
export async function sendWaText(phone, message, cfg = {}) {
    const secret = String(cfg.secretKey || "").trim()
        || process.env.SIDOBE_SECRET_KEY || process.env.WA_SECRET_KEY || "";
    if (!secret) {
        console.warn("[WaNotify] Secret key WA belum diatur (Settings → Konfigurasi WA) — pesan tidak dikirim.");
        return { ok: false, error: "no-secret" };
    }
    const target = normalizeWaPhone(phone);
    if (!target) return { ok: false, error: "no-phone" };
    // Provider: config company → env → default. URL disimpan PENUH
    // (.../send-message) per spek Settings; dinormalisasi ke base endpoint.
    const providerBase = normalizeProviderBase(
        String(cfg.providerUrl || "").trim() || process.env.SIDOBE_BASE_URL || ""
    );
    const body = { phone: target, message, is_async: true };
    // Nomor pengirim (opsional) — dikirim sebagai sender_phone bila diisi
    // (dokumentasi Sidobe: field sender_phone, E.164).
    const sender = String(cfg.senderNumber || "").trim();
    if (sender) body.sender_phone = normalizeWaPhone(sender);
    try {
        const res = await fetch(`${providerBase}/send-message`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Secret-Key": secret
            },
            body: JSON.stringify(body)
        });
        let resBody = null;
        try { resBody = await res.json(); } catch { /* non-JSON */ }
        if (!res.ok) {
            console.warn(`[WaNotify] Sidobe ${res.status}:`, JSON.stringify(resBody || {}).slice(0, 300));
            return { ok: false, status: res.status, error: (resBody && resBody.message) || String(res.status) };
        }
        if (resBody && resBody.is_success === false) {
            console.warn("[WaNotify] Sidobe is_success=false:", JSON.stringify(resBody).slice(0, 300));
            return { ok: false, error: (resBody && resBody.message) || "is_success=false" };
        }
        return { ok: true };
    } catch (err) {
        console.warn("[WaNotify] Gagal kirim WA:", err && err.message ? err.message : err);
        return { ok: false, error: err && err.message ? err.message : String(err) };
    }
}

/**
 * Kirim notifikasi status order ke WA customer (bila nomor tersimpan).
 * Konfigurasi gateway dibaca dari Company (Settings → Konfigurasi WA);
 * fallback env SIDOBE_* bila company belum mengisi.
 * @param {object} order Dokumen TableOrder (harus punya customerWhatsapp)
 * @param {"received"|"ready"|"paid"|"cancelled"|"items_cancelled"|"refunded"|""} event
 * @returns {Promise<{ok: boolean, reason?: string, error?: string}>}
 */
export async function notifyOrderWhatsapp(order, event = "") {
    try {
        if (!order || !order.customerWhatsapp) {
            return { ok: false, reason: "no-customer-wa" };
        }
        // Konfigurasi gateway + rekening bank (utk pesan received) paralel.
        const [cfg, bankAccounts] = await Promise.all([
            loadWaConfig(order.companyCode),
            loadBankAccounts(order.companyCode)
        ]);
        const message = buildWaOrderMessage(order, event, { bankAccounts });
        if (!message) return { ok: false, reason: "unknown-event" };
        return await sendWaText(order.customerWhatsapp, message, cfg);
    } catch (err) {
        console.warn("[WaNotify] notify gagal:", err && err.message ? err.message : err);
        return { ok: false, error: err && err.message ? err.message : String(err) };
    }
}

export default {
    normalizeWaPhone,
    normalizeMejaLabel,
    statusUrlOf,
    normalizeProviderBase,
    loadWaConfig,
    loadBankAccounts,
    buildWaOrderMessage,
    sendWaText,
    notifyOrderWhatsapp
};
