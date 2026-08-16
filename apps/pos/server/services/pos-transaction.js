/**
 * POS Transaction Helpers — pure functions (SP-029 M3, PRD V1).
 *
 * Logika penjualan kasir yang bergantung pada `behavior` barang (PRD V1 §9):
 *   - trading      → barang fisik, stok berkurang saat terjual
 *   - service      → jasa, TIDAK mengurangi stok
 *   - recipe       → resep MODEL SIMPLE (dijual TANPA kurangi stok produk;
 *                     penyesuaian stok manual via stok opname)
 *   - recipe-fnb   → resep TERHUBUNG Recipe F&B (M6.2): produk tidak punya
 *                     stok sendiri — bahan (ingredient) yang dikurangi
 *                     realtime saat transaksi (engine BOM di services/recipe)
 *   - manufactured → produksi (placeholder V1, tanpa dampak stok)
 *   - digital      → produk digital (placeholder V1, tanpa dampak stok)
 *
 * Dipisah sebagai pure functions agar mudah di-unit-test tanpa DB.
 *
 * @module server/services/pos-transaction
 */

// Behavior yang TIDAK mengurangi stok saat terjual (V1).
// recipe-fnb: produk menu tidak punya stok — ingredient yang dikonsumsi.
const NO_STOCK_BEHAVIORS = new Set(["service", "recipe", "recipe-fnb", "manufactured", "digital"]);

/**
 * Pisahkan item transaksi berdasarkan behavior barangnya.
 *
 * @param {object[]} items Item transaksi ({ kode, qty, … })
 * @param {object[]} [barangs] Daftar Barang ({ kode, behavior }) — bisa dari DB
 * @returns {{ trading: object[], noStock: object[], noStockKodes: Set<string>, service: object[], serviceKodes: Set<string> }}
 */
export function splitPosItemsByBehavior(items = [], barangs = []) {
    const noStockKodes = new Set(
        (barangs || [])
            .filter(b => NO_STOCK_BEHAVIORS.has(String(b.behavior || "trading")))
            .map(b => b.kode)
    );
    // Backward-compat: set serviceKodes tetap diisi utk kode service saja.
    const serviceKodes = new Set(
        (barangs || [])
            .filter(b => String(b.behavior || "trading") === "service")
            .map(b => b.kode)
    );
    const trading = [];
    const noStock = [];
    const service = [];
    for (const item of items || []) {
        if (noStockKodes.has(item.kode)) {
            noStock.push(item);
            if (serviceKodes.has(item.kode)) service.push(item);
        } else {
            trading.push(item);
        }
    }
    return { trading, noStock, noStockKodes, service, serviceKodes };
}

/**
 * Item retur penjualan yang memengaruhi stok — kebalikan penjualan:
 * hanya barang `trading` (fisik) yang stoknya dikembalikan bertambah saat
 * pelanggan mengembalikan barang. Service/recipe/recipe-fnb/manufactured/
 * digital tidak pernah memakai stok sendiri → tidak di-retur-kan ke stok
 * (PRD V1 §8–9, keputusan PO C1 2026-08-10).
 *
 * @param {object[]} items Item retur ({ kode, qty, … })
 * @param {object[]} [barangs] Daftar Barang ({ kode, behavior }) — bisa dari DB
 * @returns {object[]} Hanya item behavior trading
 */
export function returStockItems(items = [], barangs = []) {
    return splitPosItemsByBehavior(items, barangs).trading;
}

/**
 * Tarif pajak POS default — keputusan PO 2026-08-10: 11%.
 * @type {number}
 */
export const POS_TAX_RATE = 0.11;

/**
 * Hitung pajak transaksi POS (pembulatan rupiah).
 * @param {number} subtotal Nilai sebelum pajak
 * @returns {number}
 */
export function calcPosTax(subtotal) {
    const s = Math.max(0, Number(subtotal) || 0);
    return Math.round(s * POS_TAX_RATE);
}

/**
 * Normalisasi payload penjualan POS — nilai numerik aman, default pelanggan.
 * Kembalian akhir dihitung ulang di route setelah grandTotal diketahui.
 *
 * @param {object} body Request body
 * @returns {{ pelanggan: string, pelangganNama: string, kasir: string, pajak: number, bayar: number, kembalian: number, diskon: number }}
 */
export function normalizePosPayload(body = {}) {
    const bayar = Math.max(0, Number(body.bayar) || 0);
    return {
        pelanggan: (body.pelanggan && String(body.pelanggan).trim()) || "UMUM",
        pelangganNama: (body.pelangganNama && String(body.pelangganNama).trim()) || "Pelanggan Umum",
        kasir: (body.kasir && String(body.kasir).trim()) || "Kasir",
        pajak: Math.max(0, Number(body.pajak) || 0),
        bayar,
        kembalian: Math.max(0, Number(body.kembalian) || 0),
        diskon: Math.max(0, Number(body.diskon) || 0)
    };
}

/**
 * Resolve flag create transaksi POS — penjualan lunas vs hold draft.
 *
 * PRD V1 §7.5: hold = keranjang sementara yang BELUM jadi penjualan:
 *   - enforcePayment = false  (tidak wajib bayar ≥ grandTotal)
 *   - decrementStock = false  (stok tidak berubah saat hold)
 *   - status "held", tanpa noKwitansi
 *
 * @param {object} body Request body ({ sumber, hold })
 * @returns {{ isPos: boolean, isHold: boolean, enforcePayment: boolean, decrementStock: boolean }}
 */
export function resolvePosCreateFlags(body = {}) {
    const isPos = Boolean(body && body.sumber === "pos");
    const isHold = Boolean(isPos && body && body.hold === true);
    return {
        isPos,
        isHold,
        enforcePayment: isPos && !isHold,
        decrementStock: isPos && !isHold
    };
}

/**
 * Normalisasi jenis pelanggan transaksi kasir (M3-FIX v19, PRD V1 §7.4).
 *
 * "member" → berlaku harga khusus (harga_khusus) saat checkout;
 * "umum"   → harga normal (default, backward-compatible).
 * Nilai selain "member" selalu dianggap "umum".
 *
 * @param {*} v Nilai mentah dari request body
 * @returns {"umum"|"member"}
 */
export function normalizeTipePelanggan(v) {
    return String(v || "umum").toLowerCase() === "member" ? "member" : "umum";
}

/**
 * PRD V1 §7.5 — validasi transisi status Hold/Resume (state machine murni).
 *
 * Hold   : hanya transaksi POS yang belum dibayar (status "order") bisa ditahan.
 *          Status "held" = keranjang sementara — stok TIDAK berubah.
 * Resume : hanya status "held" yang bisa dilanjutkan (→ "order").
 *
 * @param {string} status Status transaksi saat ini
 * @param {"hold"|"resume"} action Aksi yang diminta
 * @returns {{ ok: boolean, message?: string }} ok=false berisi pesan error
 */
export function checkHoldResumeTransition(status, action) {
    const current = String(status || "");
    if (action === "hold") {
        if (current !== "order") {
            return { ok: false, message: `Transaksi berstatus "${current}" tidak bisa di-hold` };
        }
        return { ok: true };
    }
    if (action === "resume") {
        if (current !== "held") {
            return { ok: false, message: `Transaksi berstatus "${current}" tidak bisa di-resume` };
        }
        return { ok: true };
    }
    return { ok: false, message: `Aksi tidak dikenal: ${action}` };
}
