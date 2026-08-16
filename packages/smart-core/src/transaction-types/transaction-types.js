/**
 * Transaction Capability Registry — SMART POS (V1).
 *
 * Satu-satunya sumber kebenaran (single source of truth) untuk daftar
 * capability jenis transaksi POS. Dipakai oleh:
 *   - SMART Console (admin): katalog checkbox "Jenis Transaksi Kasir"
 *   - POS server: validasi penyimpanan & gate endpoint transaksi
 *   - POS client: filter menu/route berdasarkan capability yang diaktifkan
 *
 * Konsep (Transaction Capability Foundation V1):
 *   1. Available Capability — capability yang secara platform tersedia (di sini).
 *   2. Enabled Capability   — capability yang diaktifkan untuk perusahaan
 *      (Company.transactionTypes, dikelola Master Platform / Admin POS).
 *   3. User Permission      — hak role/user (framework permission existing).
 *
 * Menambahkan capability baru CUKUP menambah entri di TRANSACTION_TYPES —
 * tanpa mengubah struktur database utama (Company.transactionTypes tetap
 * array of string).
 *
 * @module @smart/core/transaction-types
 */

/**
 * Katalog capability V1.
 * @type {Array<{key: string, label: string, description: string}>}
 */
export const TRANSACTION_TYPES = [
    { key: "retail", label: "Retail", description: "Penjualan barang secara langsung" },
    { key: "fnb", label: "F&B", description: "Transaksi makanan dan minuman" },
    { key: "service", label: "Jasa", description: "Transaksi penjualan jasa" },
    { key: "ppob", label: "PPOB", description: "Pembayaran tagihan & isi ulang (PPOB)" },
    { key: "preorder", label: "Pre-Order", description: "Pesanan barang yang dipesan terlebih dahulu" },
    { key: "reservation", label: "Reservasi", description: "Pemesanan meja / waktu layanan" },
    { key: "membership", label: "Membership", description: "Transaksi keanggotaan & isi saldo member" }
];

/**
 * Default V1 yang aman — backward compatible dengan perilaku POS saat ini
 * (retail-only). Company lama yang belum memiliki field `transactionTypes`
 * diperlakukan seolah mengaktifkan daftar ini.
 * @type {string[]}
 */
export const DEFAULT_TRANSACTION_TYPES = ["retail"];

/**
 * Himpunan key capability yang dikenal (turunan TRANSACTION_TYPES).
 * @type {Set<string>}
 */
export const TRANSACTION_TYPE_KEYS = new Set(TRANSACTION_TYPES.map(t => t.key));

/**
 * Apakah sebuah key merupakan capability terdaftar?
 * @param {unknown} key
 * @returns {boolean}
 */
export function isKnownTransactionType(key) {
    return typeof key === "string" && TRANSACTION_TYPE_KEYS.has(key);
}

/**
 * Metadata capability berdasarkan key.
 * @param {string} key
 * @returns {object|null} { key, label, description } atau null bila tak dikenal
 */
export function getTransactionTypeMeta(key) {
    return TRANSACTION_TYPES.find(t => t.key === key) || null;
}

/**
 * Normalisasi TOLERAN untuk pembacaan (read path):
 * - non-array → []
 * - entry non-string / tak dikenal → dibuang
 * - duplikat → dihapus (urutannya dipertahankan)
 *
 * Beda dengan validateTransactionTypes (write path): fungsi ini TIDAK menolak,
 * hanya membersihkan — dipakai untuk fallback aman data legacy / input liar.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeTransactionTypes(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    for (const key of raw) {
        if (typeof key !== "string" || !TRANSACTION_TYPE_KEYS.has(key)) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(key);
    }
    return out;
}

/**
 * Validasi KETAT untuk penyimpanan (write path) — mengikuti aturan bisnis:
 * - harus array
 * - setiap entry harus string & capability TERDAFTAR (unknown → ditolak)
 * - duplikasi capability → ditolak
 * - array kosong → diperbolehkan (secara bisnis valid: tanpa capability)
 * @param {unknown} raw
 * @returns {{ok: true, value: string[]} | {ok: false, error: string}}
 */
export function validateTransactionTypes(raw) {
    if (!Array.isArray(raw)) {
        return { ok: false, error: "transactionTypes harus berupa array" };
    }
    const seen = new Set();
    for (const key of raw) {
        if (typeof key !== "string" || !TRANSACTION_TYPE_KEYS.has(key)) {
            return { ok: false, error: `Capability \"${String(key)}\" tidak dikenal` };
        }
        if (seen.has(key)) {
            return { ok: false, error: `Capability duplikat: \"${key}\"` };
        }
        seen.add(key);
    }
    return { ok: true, value: [...seen] };
}

/**
 * Apakah capability tertentu aktif dalam daftar capability yang di-enabled?
 * Fallback default V1 (["retail"]) bila daftar tidak disediakan (company lama).
 * @param {string[]|undefined|null} enabled Daftar capability yang diaktifkan
 * @param {string} key Key capability (mis. "retail", "fnb")
 * @returns {boolean}
 */
export function isTransactionTypeEnabled(enabled, key) {
    const list = Array.isArray(enabled) && enabled.length >= 0
        ? enabled
        : DEFAULT_TRANSACTION_TYPES;
    return list.includes(key);
}

/**
 * Filter menu/route berdasarkan capability yang diaktifkan (pure).
 *
 * Item dengan field `capability` hanya dipertahankan bila capability tsb
 * ada di daftar enabled; item tanpa `capability` selalu dipertahankan
 * (netral — tidak terikat capability). Grup yang semua anaknya terhapus
 * ikut dihapus. Mirip filterMenusByLokasi (pola existing).
 *
 * @param {Array} items Struktur menu (title/icon/page/children/capability)
 * @param {string[]} enabled Daftar capability yang diaktifkan perusahaan
 * @returns {Array}
 */
export function filterMenusByTransactionTypes(items, enabled) {
    const enabledSet = new Set(Array.isArray(enabled) ? enabled : DEFAULT_TRANSACTION_TYPES);
    const walk = (list) => list.reduce((acc, item) => {
        if (item.children && item.children.length > 0) {
            const children = walk(item.children);
            if (children.length > 0) acc.push({ ...item, children });
            return acc;
        }
        if (item.capability && !enabledSet.has(item.capability)) return acc;
        acc.push(item);
        return acc;
    }, []);
    return walk(items);
}

export default {
    TRANSACTION_TYPES,
    TRANSACTION_TYPE_KEYS,
    DEFAULT_TRANSACTION_TYPES,
    isKnownTransactionType,
    getTransactionTypeMeta,
    normalizeTransactionTypes,
    validateTransactionTypes,
    isTransactionTypeEnabled,
    filterMenusByTransactionTypes
};
