/**
 * Password Hashing — bcrypt.
 *
 * SP-027 M3: Seluruh password WAJIB di-hash dengan bcrypt sebelum disimpan.
 * Tidak boleh ada perbandingan plaintext.
 *
 * @module @smart/security/password
 */

import bcrypt from "bcryptjs";

const BCRYPT_PREFIX_RE = /^\$2[aby]\$\d{2}\$/;

/**
 * Hash sebuah password dengan bcrypt.
 * @param {string} plain Password plaintext
 * @param {number} [rounds] Cost factor (default 10)
 * @returns {Promise<string>} Hash bcrypt
 */
export async function hashPassword(plain, rounds = 10) {
    return bcrypt.hash(String(plain == null ? "" : plain), rounds);
}

/**
 * Verifikasi password plaintext terhadap hash bcrypt.
 * Aman untuk hash non-bcrypt / kosong — selalu return false.
 * @param {string} plain Password plaintext dari user
 * @param {string} hash Hash bcrypt tersimpan
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plain, hash) {
    if (!plain || !hash || typeof plain !== "string" || typeof hash !== "string") {
        return false;
    }
    if (!isBcryptHash(hash)) {
        return false;
    }
    try {
        return await bcrypt.compare(plain, hash);
    } catch {
        return false;
    }
}

/**
 * Cek apakah sebuah string adalah hash bcrypt.
 * @param {string} value
 * @returns {boolean}
 */
export function isBcryptHash(value) {
    return typeof value === "string" && BCRYPT_PREFIX_RE.test(value);
}

/**
 * Apakah password tersimpan masih plaintext (belum di-hash)?
 * @param {string} stored
 * @returns {boolean}
 */
export function isPlainPassword(stored) {
    return typeof stored === "string" && stored.length > 0 && !isBcryptHash(stored);
}

/**
 * Hash password jika masih plaintext (migrasi idempotent).
 * @param {string} stored Password tersimpan
 * @param {number} [rounds]
 * @returns {Promise<string>} Hash bcrypt
 */
export async function hashPasswordIfPlain(stored, rounds = 10) {
    if (isBcryptHash(stored)) {
        return stored;
    }
    return hashPassword(stored, rounds);
}

export default { hashPassword, verifyPassword, isBcryptHash, isPlainPassword, hashPasswordIfPlain };
