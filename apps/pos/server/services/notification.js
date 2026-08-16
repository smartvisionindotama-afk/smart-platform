/**
 * Notification Service — builder & helper notifikasi role-based (F&B V1).
 *
 * Fungsi PURE (testable) untuk menyusun notifikasi bell:
 *   - buildKitchenOrderNotification(order)   — order baru masuk (kitchen)
 *   - buildPaymentProofNotification(order)   — bukti pembayaran (cashier)
 *   - buildOrderItemsSummary(items)          — ringkasan item utk message
 *
 * Event per role dibedakan (role separation §4):
 *   KITCHEN → order_new (dibuat saat order qr_table sukses)
 *   CASHIER → payment_proof (dibuat saat customer upload bukti)
 *   CUSTOMER → Web Push (approved/rejected/ready) — terpisah, tanpa bell.
 *
 * @module pos/server/services/notification
 */

/**
 * Ringkasan item order utk pesan notifikasi (ringkas, maks `max` item).
 * @param {Array} items [{ nama, qty }]
 * @param {number} [max=3]
 * @returns {string} contoh: "2× Nasi Goreng, 1× Es Teh +2 lagi"
 */
export function buildOrderItemsSummary(items, max = 3) {
    if (!Array.isArray(items) || !items.length) return "";
    const lines = items
        .slice(0, max)
        .map(i => `${Number(i.qty) || 0}× ${String(i.nama || "").trim()}`)
        .filter(Boolean);
    const more = items.length > max ? ` +${items.length - max} lagi` : "";
    return lines.join(", ") + more;
}

/**
 * Notifikasi KITCHEN — order baru masuk (dibuat saat order qr_table sukses).
 * Hanya dipanggil bila order mengandung item RECIPE / RECIPE-FNB (§1).
 * `order.kitchenItems` (subset dapur) dipakai bila ada — kitchen HANYA
 * melihat item resep, bukan barang dagangan/jasa.
 * @param {object} order Dokumen TableOrder
 * @returns {object} Field notifikasi (tanpa companyCode — diisi route)
 */
export function buildKitchenOrderNotification(order = {}) {
    const kitchenItems = (Array.isArray(order.kitchenItems) && order.kitchenItems.length)
        ? order.kitchenItems
        : order.items;
    return {
        targetRole: "kitchen",
        type: "order_new",
        title: "Order baru masuk",
        message: `${order.orderId || ""} · ${order.nomorMeja || ""}`,
        payload: {
            itemsSummary: buildOrderItemsSummary(kitchenItems),
            items: (kitchenItems || []).slice(0, 10).map(i => ({
                nama: i.nama || "",
                qty: Number(i.qty) || 0
            }))
        }
    };
}

/**
 * Notifikasi CASHIER — bukti pembayaran menunggu verifikasi.
 * @param {object} order Dokumen TableOrder
 * @returns {object} Field notifikasi (tanpa companyCode — diisi route)
 */
export function buildPaymentProofNotification(order = {}) {
    return {
        targetRole: "cashier",
        type: "payment_proof",
        title: "Pembayaran baru menunggu verifikasi",
        message: `${order.orderId || ""} · ${order.nomorMeja || ""} · ${String(order.paymentMethod || "").toUpperCase()} · Rp ${Number(order.total || 0).toLocaleString("id-ID")}`,
        payload: {
            paymentMethod: order.paymentMethod || "",
            amount: Number(order.total) || 0
        }
    };
}

/**
 * Notifikasi CASHIER — ORDER DIBATALKAN oleh kitchen (SEBAGIAN / seluruh).
 * Bila order sudah LUNAS (paymentStatus=paid), kasir WAJIB melakukan REFUND
 * (payload.needsRefund=true + nominal — full order ATAU parsial sesuai item
 * yang dibatalkan). Notifikasi TETAP dikirim walau order belum lunas.
 * @param {object} order Dokumen TableOrder (kitchenStatus=cancelled ATAU
 *        sebagian itemnya ditandai cancelled)
 * @returns {object} Field notifikasi (tanpa companyCode — diisi route)
 */
export function buildOrderCancelledNotification(order = {}) {
    const needsRefund = order.paymentStatus === "paid";
    const items = Array.isArray(order.items) ? order.items : [];
    const cancelledItems = items.filter(i => i && i.cancelled);
    const partial = cancelledItems.length > 0 && cancelledItems.length < items.length;
    const summary = cancelledItems.length
        ? buildOrderItemsSummary(cancelledItems)
        : buildOrderItemsSummary(items);
    const refundAmount = needsRefund ? (Number(order.refundAmount || order.total || 0)) : 0;
    return {
        targetRole: "cashier",
        type: "order_cancelled",
        title: needsRefund
            ? `⚠️ ${partial ? "Item dibatalkan" : "Order dibatalkan"} — PERLU REFUND`
            : (partial ? "Item dibatalkan" : "Order dibatalkan"),
        message: `${order.orderId || ""} · Meja ${order.nomorMeja || "-"}${summary ? ` · ${summary}` : ""}${needsRefund
            ? ` · SUDAH LUNAS — refund Rp ${refundAmount.toLocaleString("id-ID")}`
            : " · belum lunas (tanpa refund)"}`,
        payload: {
            paymentStatus: order.paymentStatus || "pending",
            total: Number(order.total) || 0,
            refundAmount,
            needsRefund,
            partial,
            cancelledItems: cancelledItems.slice(0, 10).map(i => ({
                nama: i.nama || "",
                qty: Number(i.qty) || 0
            }))
        }
    };
}

export default {
    buildOrderItemsSummary,
    buildKitchenOrderNotification,
    buildPaymentProofNotification,
    buildOrderCancelledNotification
};
