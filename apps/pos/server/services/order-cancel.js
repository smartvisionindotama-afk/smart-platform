/**
 * Order Cancel Service — pembatalan PER-ITEM oleh kitchen (F&B V1).
 *
 * Kitchen TIDAK selalu membatalkan seluruh order: chef bisa membatalkan
 * SATU ATAU BEBERAPA baris (mis. 2 item dapur) sementara item lain tetap
 * dibuat. Fungsi di sini PURE (testable — tanpa DB):
 *
 *   cancelOrderItems(order, itemIds, actor, reason)
 *     → menandai baris yang cocok (item.cancelled), menghitung nilai yang
 *       dibatalkan (cancelledSubtotal + refundAmount termasuk pajak
 *       proporsional), dan menyimpulkan efeknya:
 *         - allCancelled      : SEMUA baris order dibatalkan → order batal total
 *         - kitchenRemaining  : sisa baris dapur (recipe/recipe-fnb) yang belum
 *                               dibatalkan → 0 = dapur selesai (order ready)
 *
 * Semua angka dibulatkan 2 desimal (pola transaksi POS). Item data legacy
 * TANPA itemId tidak bisa dibatalkan per-item (fallback: batalkan order
 * seluruhnya via route /cancel).
 *
 * @module pos/server/services/order-cancel
 */

/**
 * Tandai baris item sebagai dibatalkan (mutasi langsung pada dokumen order).
 * @param {object} order Dokumen TableOrder ({ items, kitchenItems, subtotal, pajak })
 * @param {string[]} itemIds Daftar itemId baris yang dibatalkan (diabaikan
 *        bila opts.forceAll=true — dipakai batalkan SELURUH order, termasuk
 *        item legacy tanpa itemId)
 * @param {string} actor Nama chef/kasir
 * @param {string} [reason] Catatan pembatalan (maks 300)
 * @param {{ forceAll?: boolean }} [opts]
 * @returns {{ marked: number, cancelledSubtotal: number, refundAmount: number,
 *             allCancelled: boolean, kitchenRemaining: number }}
 */
export function cancelOrderItems(order, itemIds, actor, reason, opts = {}) {
    const forceAll = Boolean(opts && opts.forceAll);
    const ids = new Set(
        (Array.isArray(itemIds) ? itemIds : [])
            .map(i => String(i || "").trim())
            .filter(Boolean)
    );
    const subtotal = Number(order.subtotal) || 0;
    const pajak = Number(order.pajak) || 0;
    const reasonText = String(reason || "").slice(0, 300);
    const now = new Date();
    const mark = (it) => {
        it.cancelled = true;
        it.cancelledAt = now;
        it.cancelledBy = actor;
        it.cancelReason = reasonText;
    };
    const isSelected = (it) => {
        if (forceAll) return true;
        const id = String((it && it.itemId) || "").trim();
        return Boolean(id && ids.has(id));
    };

    // `items` = sumber kebenaran nilai & jumlah baris (kitchenItems hanyalah
    // SUBSET dari items — subdoc terpisah di DB, jadi iterasi dua-duanya akan
    // menggandakan nilai). Hitung dari `items`, lalu MIRROR flag ke kitchenItems.
    let cancelledSubtotal = 0;
    let marked = 0;
    for (const it of (Array.isArray(order.items) ? order.items : [])) {
        if (!it || it.cancelled || !isSelected(it)) continue;
        mark(it);
        cancelledSubtotal += Number(it.subtotal) || 0;
        marked++;
    }
    for (const it of (Array.isArray(order.kitchenItems) ? order.kitchenItems : [])) {
        if (!it || it.cancelled || !isSelected(it)) continue;
        mark(it);
    }
    cancelledSubtotal = Math.round(cancelledSubtotal * 100) / 100;

    const allItems = Array.isArray(order.items) ? order.items : [];
    const kitchenItems = Array.isArray(order.kitchenItems) ? order.kitchenItems : [];
    const cancelledCount = allItems.filter(i => i && i.cancelled).length;
    const allCancelled = allItems.length > 0 && cancelledCount === allItems.length;
    const kitchenRemaining = kitchenItems.filter(i => i && !i.cancelled).length;

    // Refund parsial = nilai item dibatalkan + pajak PROPORSIONAL
    // (pajak order dibagi rata atas subtotal: pajak/subtotal × nilai dibatalkan).
    const rate = subtotal > 0 ? pajak / subtotal : 0;
    const refundAmount = Math.round(cancelledSubtotal * (1 + rate) * 100) / 100;

    return { marked, cancelledSubtotal, refundAmount, allCancelled, kitchenRemaining };
}

export default { cancelOrderItems };
