/**
 * QR Menu Service — F&B Customer Ordering V1 (pure helpers, testable).
 *
 * Tanggung jawab:
 *   - generate token internal QR meja & token order customer
 *   - format order id (ORDER #000125 — sequential per company)
 *   - resolve item order → harga dari MASTER (harga TIDAK diambil dari
 *     client; server menghitung dari Barang/Recipe/SKU — keamanan multi-tenant)
 *
 * @module pos/server/services/qr-menu
 */

import crypto from "crypto";

/**
 * Token acak URL-safe (tanpa karakter ambigu) utk QR identifier / order token.
 * @param {number} [bytes] Panjang entropi (default 10 → 80 bit, cukup utk
 *   identifier QR; order token memakai 18 → 144 bit).
 * @returns {string}
 */
export function generateToken(bytes = 10) {
    return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * Format nomor order jadi id tampilan: ORDER #000125.
 * @param {number} n
 * @returns {string}
 */
export function formatOrderId(n) {
    return `ORDER #${String(n).padStart(6, "0")}`;
}

/**
 * Harga satuan item berdasarkan pilihan customer (server-side pricing):
 *   - tanpa varian/SKU        → harga_jual produk
 *   - recipeId (varian F&B)   → harga recipe bila > 0, fallback harga produk
 *   - skuKode (varian SKU)    → harga SKU (pelanggan umum — harga_khusus
 *     hanya utk member terverifikasi di kasir, bukan customer QR)
 * @param {object} p Produk master ({ _id, harga_jual, skus: [] })
 * @param {object|null} recipe Recipe aktif ({ _id, harga }) atau null
 * @param {string} [skuKode] Kode SKU terpilih
 * @returns {number} Harga satuan (≥ 0)
 */
export function resolveItemHarga(p, recipe = null, skuKode = "") {
    const base = Math.max(0, Number(p && p.harga_jual) || 0);
    if (skuKode && Array.isArray(p && p.skus)) {
        const sku = p.skus.find(s => String(s.kode || "") === String(skuKode));
        if (sku) return Math.max(0, Number(sku.harga) || 0);
    }
    if (recipe) {
        const recipeHarga = Math.max(0, Number(recipe.harga) || 0);
        if (recipeHarga > 0) return recipeHarga;
    }
    return base;
}

/**
 * Normalisasi + validasi item order customer (pure, DI-test).
 *
 * Raw item dari client: { productId, qty, recipeId?, skuKode?, catatan? }.
 * Setiap item dicek terhadap katalog produk (map id → Barang) dan recipe
 * aktif (map recipeId → Recipe). Harga dihitung server (resolveItemHarga).
 *
 * @param {Array} rawItems Item mentah dari body request
 * @param {Map<string, object>} productMap Map productId → produk master
 * @param {Map<string, object>} recipeMap Map recipeId → recipe aktif
 * @returns {{ok: true, items: object[], subtotal: number} | {ok: false, error: string}}
 */
export function resolveOrderItems(rawItems, productMap, recipeMap) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return { ok: false, error: "Items wajib diisi (minimal 1 item)" };
    }
    const items = [];
    let subtotal = 0;
    for (const raw of rawItems) {
        if (!raw || typeof raw !== "object") {
            return { ok: false, error: "Format item tidak valid" };
        }
        const productId = String(raw.productId || "").trim();
        const p = productMap.get(productId);
        if (!p) {
            return { ok: false, error: `Produk tidak ditemukan (id: ${productId || "-"})` };
        }
        const qty = Number(raw.qty);
        if (!Number.isInteger(qty) || qty < 1) {
            return { ok: false, error: `Jumlah item \"${p.nama || p.kode}\" tidak valid` };
        }
        if (qty > 999) {
            return { ok: false, error: `Jumlah item \"${p.nama || p.kode}\" melebihi batas (maks 999)` };
        }

        const recipeId = String(raw.recipeId || "").trim();
        const recipe = recipeId ? (recipeMap.get(recipeId) || null) : null;
        // recipeId dikirim tapi tidak ditemukan → tolak (bukan diam-diam pakai default)
        if (recipeId && !recipe) {
            return { ok: false, error: `Varian produk tidak ditemukan (${recipeId})` };
        }

        const skuKode = String(raw.skuKode || "").trim();
        if (skuKode && Array.isArray(p.skus) && p.skus.length) {
            const skuExists = p.skus.some(s => String(s.kode || "") === skuKode);
            if (!skuExists) {
                return { ok: false, error: `SKU tidak ditemukan untuk \"${p.nama || p.kode}\" (${skuKode})` };
            }
        }

        const harga = resolveItemHarga(p, recipe, skuKode);
        // Nama tampilan menyertakan VARIAN yang dipilih customer — pola sama
        // dengan resep F&B ("Produk (Varian)") — berlaku untuk SEMUA tipe
        // produk ber-SKU: trading, service, resep simple (resep F&B memakai
        // recipeId). Struk/order/kitchen menampilkan `nama` → varian terlihat.
        const sku = skuKode && Array.isArray(p.skus)
            ? (p.skus.find(s => String(s.kode || "") === skuKode) || null)
            : null;
        const nama = recipe
            ? `${p.nama || p.kode} (${recipe.name || "Varian"})`
            : (sku
                ? `${p.nama || p.kode} (${String(sku.label || skuKode || "Varian").trim()})`
                : (p.nama || p.kode || "-"));
        items.push({
            productId,
            kode: p.kode || "",
            nama,
            skuKode,
            skuLabel: skuKode && Array.isArray(p.skus)
                ? (p.skus.find(s => String(s.kode || "") === skuKode)?.label || skuKode)
                : "",
            recipeId,
            recipeNama: recipe ? recipe.name || "" : "",
            harga,
            qty,
            subtotal: Math.round(harga * qty * 100) / 100,
            catatan: String(raw.catatan || "").slice(0, 200)
        });
        subtotal += items[items.length - 1].subtotal;
    }
    subtotal = Math.round(subtotal * 100) / 100;
    return { ok: true, items, subtotal };
}

/**
 * Ambil nomor order berikutnya utk company (sequential, 1-based).
 * @param {Function} findMax (companyCode) => Promise<number|null> — DI testable
 * @param {string} companyCode
 * @returns {Promise<number>}
 */
export async function nextOrderNumber(findMax, companyCode) {
    const max = await findMax(companyCode);
    return (Number(max) || 0) + 1;
}

export default {
    generateToken,
    formatOrderId,
    resolveItemHarga,
    resolveOrderItems,
    nextOrderNumber
};
