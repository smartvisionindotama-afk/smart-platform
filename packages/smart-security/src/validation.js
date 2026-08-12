/**
 * Request Validation — sanitasi & validasi input ringan (tanpa dependensi).
 *
 * SP-027 M3: validasi dasar untuk endpoint autentikasi & mutasi.
 *
 * @module @smart/security/validation
 */

/**
 * Bersihkan string (trim + batasi panjang).
 * @param {*} value
 * @param {number} [max]
 * @returns {string}
 */
export function cleanString(value, max = 200) {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value).trim().slice(0, max);
}

/**
 * Validasi input login.
 * @param {object} [body]
 * @returns {{ ok: boolean, error?: string, username?: string, password?: string }}
 */
export function validateLoginInput(body = {}) {
    const username = cleanString(body.username, 100);
    if (!username) {
        return { ok: false, error: "Username wajib diisi" };
    }
    const password = body.password;
    if (typeof password !== "string" || password.length === 0) {
        return { ok: false, error: "Password wajib diisi" };
    }
    if (password.length > 200) {
        return { ok: false, error: "Password terlalu panjang" };
    }
    return { ok: true, username, password };
}

/**
 * Validasi password baru (aturan: minimal 6 karakter — backward compatible).
 * @param {*} password
 * @returns {{ ok: boolean, error?: string, password?: string }}
 */
export function validateNewPassword(password) {
    if (typeof password !== "string" || password.length < 6) {
        return { ok: false, error: "Password minimal 6 karakter" };
    }
    if (password.length > 200) {
        return { ok: false, error: "Password terlalu panjang" };
    }
    return { ok: true, password };
}

/**
 * Validasi email sederhana (format dasar).
 * @param {*} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
    return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default { cleanString, validateLoginInput, validateNewPassword, isValidEmail };
