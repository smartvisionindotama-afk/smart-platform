/**
 * Notification Data Services — Role-Based Notification Bell (F&B V1).
 *
 * Backend: /api/notifications (permission mengikuti role):
 *   - role=cashier → pos.order.view
 *   - role=kitchen → pos.kitchen.view
 *
 * Event (role separation §4):
 *   - KITCHEN : order_new ("Order baru masuk") — dibuat saat customer order
 *   - CASHIER : payment_proof ("Pembayaran baru menunggu verifikasi")
 *
 * Bell mendukung: unread count, mark as read, open related context, timestamp.
 *
 * @module pos/data/notification-data
 */

import { apiCall } from "./api.js";

/**
 * Daftar notifikasi bell untuk satu role (company scope), terbaru dulu.
 * @param {{ role?: "cashier"|"kitchen", unread?: boolean }} [params]
 * @returns {Promise<{data: object[]}>}
 */
export async function listNotifications(params = {}) {
    const role = params.role || "cashier";
    const qs = `?role=${encodeURIComponent(role)}${params.unread ? "&unread=1" : ""}`;
    const res = await apiCall("GET", `/notifications${qs}`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Tandai satu notifikasi dibaca (UNREAD → READ).
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function markNotificationRead(id) {
    const res = await apiCall("POST", `/notifications/${encodeURIComponent(id)}/read`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Tandai SEMUA notifikasi satu role dibaca.
 * @param {"cashier"|"kitchen"} [role]
 * @returns {Promise<object>}
 */
export async function markAllNotificationsRead(role = "cashier") {
    const res = await apiCall("POST", `/notifications/read-all?role=${encodeURIComponent(role)}`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}
