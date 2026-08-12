/**
 * Format Utils — @smart/core public utils (Framework First).
 *
 * Util formatting yang bersifat GLOBAL dan dipakai lintas aplikasi
 * (POS, Inventory, Console, aplikasi SMART lainnya) — bukan milik
 * satu aplikasi tertentu.
 *
 * @module @smart/core/utils/format
 */

/**
 * Format angka menjadi format Rupiah Indonesia (id-ID, tanpa simbol Rp).
 * Contoh: 25000 → "25.000", 1234567 → "1.234.567".
 *
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatRupiah(value) {
    if (value === null || value === undefined || isNaN(value)) return "0";
    return new Intl.NumberFormat("id-ID").format(value);
}

/**
 * Format angka dengan pemisah ribuan (id-ID).
 * Alias formatRupiah — tanpa konotasi mata uang.
 *
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatNumber(value) {
    return formatRupiah(value);
}

/**
 * Format angka bulat ke ribuan Indonesia (membulatkan dulu).
 * Dipakai pada input qty/harga di modul transaksi: 1500 → "1.500".
 *
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatThousand(value) {
    const n = Math.round(Number(value) || 0);
    return n.toLocaleString("id-ID");
}

/**
 * Parsing balik string berformat ribuan ("15.000") menjadi angka bulat (15000).
 * Buang semua non-digit.
 *
 * @param {string|number|null|undefined} value
 * @returns {number}
 */
export function unformatThousand(value) {
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/\D/g, "");
    return cleaned ? parseInt(cleaned, 10) : 0;
}

/**
 * Format angka dengan prefix mata uang "Rp" (id-ID, tanpa spasi).
 * Contoh: 25000 → "Rp25.000"; null/NaN → "Rp0".
 *
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatRupiahID(value) {
    if (value === null || value === undefined || isNaN(value)) return "Rp0";
    return "Rp" + new Intl.NumberFormat("id-ID").format(value);
}

/**
 * Format desimal dengan 2 digit (id-ID), mis. untuk satuan berat/harga.
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatDecimal(value) {
    if (value === null || value === undefined || isNaN(value)) return "0";
    return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

/**
 * Parse string berformat id-ID kembali ke angka.
 * "1.234.567" → 1234567
 * @param {string|number|null|undefined} value
 * @returns {number}
 */
export function parseIdNumber(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return isNaN(value) ? 0 : value;
    const digits = String(value).replace(/[^\d-]/g, "");
    return digits ? Number(digits) : 0;
}
