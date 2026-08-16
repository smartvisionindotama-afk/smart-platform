/**
 * Customer Menu Data Services — endpoint PUBLIK QR Menu (F&B V1).
 *
 * Dipakai halaman customer /m/:identifier — TANPA login. Semua resolve
 * multi-tenant dilakukan SERVER dari qrIdentifier (company → lokasi → table).
 * Harga item dihitung server (client tidak mengirim harga).
 *
 * Fetch polos (bukan apiCall): halaman customer tidak punya token/session,
 * dan endpoint publik tidak butuh Authorization.
 *
 * @module pos/data/customer-menu-data
 */

async function request(method, path, body = null) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" }
    };
    if (body && method !== "GET") {
        options.body = JSON.stringify(body);
    }
    const res = await fetch(`/api${path}`, options);
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok) {
        throw new Error((data && data.error) || `Request gagal (${res.status})`);
    }
    return data;
}

/**
 * Ambil menu meja (produk + kategori + payment info).
 * @param {string} identifier qrIdentifier
 * @returns {Promise<object>}
 */
export async function fetchQrMenu(identifier) {
    return request("GET", `/qr/menu/${encodeURIComponent(identifier)}`);
}

/**
 * Buat order customer. Semua harga dihitung server.
 * @param {string} identifier qrIdentifier
 * @param {Array} items [{ productId, qty, recipeId?, skuKode?, catatan? }]
 * @param {string} paymentMethod "cash"|"qris"|"transfer"
 * @param {string} [catatanOrder]
 * @param {string} [customerWhatsapp] Nomor WA customer — dipakai kirim
 *        notifikasi status order via WhatsApp (Sidobe). Opsional.
 * @returns {Promise<object>} { order: { orderId, orderToken, ... } }
 */
export async function createQrOrder(identifier, items, paymentMethod, catatanOrder = "", customerWhatsapp = "") {
    return request("POST", "/qr/orders", { qrIdentifier: identifier, items, paymentMethod, catatanOrder, customerWhatsapp });
}

/**
 * Status order customer (polling). Response menyertakan riwayat bukti
 * pembayaran ({ proofs, canUploadProof }) — F&B Payment Proof V1.
 * @param {string} orderToken
 * @returns {Promise<object>} { order: {...} }
 */
export async function fetchQrOrderStatus(orderToken) {
    return request("GET", `/qr/orders/${encodeURIComponent(orderToken)}`);
}

/**
 * Upload bukti pembayaran (QRIS/Transfer) — order TETAP pending sampai
 * kasir verifikasi (PENDING → PAID hanya manual, tidak otomatis).
 * @param {string} orderToken
 * @param {string} dataUri Data URI gambar hasil kompresi client-side
 * @param {string} [fileName]
 * @returns {Promise<object>} { ok, message, proof }
 */
export async function uploadQrOrderProof(orderToken, dataUri, fileName = "") {
    return request("POST", `/qr/orders/${encodeURIComponent(orderToken)}/proof`, {
        dataUri,
        fileName: String(fileName || "").slice(0, 200)
    });
}

/**
 * VAPID public key utk subscribe.
 * @returns {Promise<string>}
 */
export async function fetchPushPublicKey() {
    const data = await request("GET", "/push/public-key");
    return data && data.publicKey ? data.publicKey : "";
}

/**
 * Simpan push subscription utk order customer.
 * @param {string} orderToken
 * @param {PushSubscription} subscription
 * @returns {Promise<object>}
 */
export async function subscribeOrderPush(orderToken, subscription) {
    return request("POST", "/push/subscribe", { orderToken, subscription });
}
