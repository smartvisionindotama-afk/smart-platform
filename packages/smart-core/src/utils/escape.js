/**
 * Escape Utils — @smart/core public utils (Framework First).
 *
 * Util escape HTML yang bersifat GLOBAL — dipakai lintas aplikasi
 * (POS, Inventory, Console) untuk mencegah XSS saat render data
 * user ke dalam HTML string.
 *
 * @module @smart/core/utils/escape
 */

/**
 * Escape string untuk disisipkan aman ke HTML (teks & atribut).
 * Mengganti & < > " ' dengan entity HTML.
 *
 * @param {string|number|null|undefined} str
 * @returns {string}
 */
export function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/**
 * Alias esc — konsisten dengan penamaan di modul auth framework.
 * @param {string|number|null|undefined} str
 * @returns {string}
 */
export function escHtml(str) {
    return esc(str);
}

/**
 * Escape untuk nilai atribut HTML (value="...").
 * Sama dengan esc (meng-escape quote ganda & tunggal).
 * @param {string|number|null|undefined} str
 * @returns {string}
 */
export function escAttr(str) {
    return esc(str);
}
