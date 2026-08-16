/**
 * Table Order Data Services — Order Meja (kasir) + Kitchen (chef) (F&B V1).
 *
 * Backend: /api/table-orders (kasir/admin) & /api/kitchen (chef).
 *
 * @module pos/data/table-order-data
 */

import { apiCall } from "./api.js";

/**
 * Daftar order meja (kasir/admin).
 * Filter: ?status=all|pending|paid|ready|completed
 * @param {{ status?: string }} [params]
 * @returns {Promise<{data: object[]}>}
 */
export async function listTableOrders(params = {}) {
    const qs = params.status ? `?status=${encodeURIComponent(params.status)}` : "";
    const res = await apiCall("GET", `/table-orders${qs}`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Detail order meja.
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function getTableOrder(id) {
    const res = await apiCall("GET", `/table-orders/${id}`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * KONFIRMASI BAYAR manual (PENDING → PAID).
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function confirmTableOrderPayment(id) {
    const res = await apiCall("POST", `/table-orders/${id}/confirm-pay`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Ubah status kitchen (kasir/admin via table-orders).
 * @param {string} id
 * @param {"preparing"|"ready"|"served"|"collected"} status
 * @returns {Promise<object>}
 */
export async function updateTableOrderKitchen(id, status) {
    const res = await apiCall("POST", `/table-orders/${id}/kitchen`, { status });
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * REFUND order yang dibatalkan & sudah lunas (kasir).
 * Refund = total order; tercatat sebagai pengurang nilai penjualan shift.
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function refundTableOrder(id) {
    const res = await apiCall("POST", `/table-orders/${id}/refund`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

// ── Kitchen (chef) ──

/**
 * Daftar order kitchen (chef): new + preparing + ready.
 * @param {{ status?: string }} [params]
 * @returns {Promise<{data: object[]}>}
 */
export async function listKitchenOrders(params = {}) {
    const qs = params.status ? `?status=${encodeURIComponent(params.status)}` : "";
    const res = await apiCall("GET", `/kitchen/orders${qs}`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Detail order kitchen (chef) — dipakai bell [LIHAT ORDER].
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function getKitchenOrder(id) {
    const res = await apiCall("GET", `/kitchen/orders/${encodeURIComponent(id)}`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Ubah status kitchen oleh chef (TERIMA / PESANAN SIAP).
 * @param {string} id
 * @param {"preparing"|"ready"} status
 * @returns {Promise<object>}
 */
export async function updateKitchenStatus(id, status) {
    const res = await apiCall("POST", `/kitchen/orders/${id}/status`, { status });
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * BATALKAN ITEM TERTENTU oleh chef (per-item — item lain tetap dibuat).
 * Body: { itemIds, reason? }. Kasir & customer diberi notifikasi; bila order
 * sudah lunas → refund PARSIAL (nilai item dibatalkan + pajak proporsional).
 * @param {string} id
 * @param {string[]} itemIds Daftar itemId baris yang dibatalkan
 * @param {string} [reason] Catatan pembatalan (opsional)
 * @returns {Promise<object>}
 */
export async function cancelKitchenOrderItems(id, itemIds, reason = "") {
    const res = await apiCall("POST", `/kitchen/orders/${id}/cancel-items`, { itemIds, reason });
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * BATALKAN SELURUH order oleh chef (hanya new/preparing — sebelum siap).
 * Kasir & customer otomatis diberi notifikasi; bila order sudah lunas,
 * kasir akan memproses refund (order masuk daftar perlu refund).
 * @param {string} id
 * @param {string} [reason] Catatan pembatalan (opsional)
 * @returns {Promise<object>}
 */
export async function cancelKitchenOrder(id, reason = "") {
    const res = await apiCall("POST", `/kitchen/orders/${id}/cancel`, { reason });
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}
