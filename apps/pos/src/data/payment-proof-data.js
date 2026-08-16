/**
 * Payment Proof Data Services — verifikasi bukti pembayaran kasir (F&B V1).
 *
 * Backend: /api/payment-proofs (permission pos.order.confirm).
 * Bell notifikasi role-based ada di ./notification-data.js (terpisah).
 *
 * @module pos/data/payment-proof-data
 */

import { apiCall } from "./api.js";

/**
 * Daftar bukti pembayaran PENDING yang perlu diverifikasi kasir.
 * @returns {Promise<{data: object[]}>}
 */
export async function listPendingProofs() {
    const res = await apiCall("GET", "/payment-proofs/pending");
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Riwayat bukti pembayaran SATU order (dgn gambar — dilihat kasir).
 * @param {string} orderId
 * @returns {Promise<{data: object[]}>}
 */
export async function listOrderProofs(orderId) {
    const res = await apiCall("GET", `/payment-proofs/order/${encodeURIComponent(orderId)}`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * APPROVE bukti pembayaran — PENDING → APPROVED; order PENDING → PAID
 * (manual, verification_method MANUAL). Customer menerima notifikasi.
 * @param {string} proofId
 * @returns {Promise<object>}
 */
export async function approvePaymentProof(proofId) {
    const res = await apiCall("POST", `/payment-proofs/${encodeURIComponent(proofId)}/approve`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * REJECT bukti pembayaran — PENDING → REJECTED; order TETAP PENDING.
 * Customer menerima notifikasi + dapat upload ulang.
 * @param {string} proofId
 * @param {string} [reason]
 * @returns {Promise<object>}
 */
export async function rejectPaymentProof(proofId, reason = "") {
    const res = await apiCall("POST", `/payment-proofs/${encodeURIComponent(proofId)}/reject`, { reason });
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}
