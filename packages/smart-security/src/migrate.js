/**
 * Password Migration — plaintext → bcrypt (idempotent, jalan tiap boot).
 *
 * SP-027 M3: data lama yang masih menyimpan password plaintext (hasil seed
 * lama) dimigrasikan otomatis menjadi hash bcrypt TANPA mengubah schema.
 *
 * @module @smart/security/migrate
 */

import { isBcryptHash, hashPassword } from "./password.js";

/**
 * Migrasikan seluruh password plaintext pada model yang diberikan.
 * @param {object} opts
 * @param {Array<{ model: object, label: string }>} opts.models
 * @param {number} [opts.rounds]
 * @param {Function} [opts.log]
 * @returns {Promise<number>} Jumlah akun yang dimigrasikan
 */
export async function migratePlaintextPasswords({ models, rounds = 10, log = console.log }) {
    let total = 0;
    for (const { model, label } of models) {
        let migrated = 0;
        try {
            const cursor = model.find({}).cursor();
            for await (const doc of cursor) {
                const stored = doc.password;
                if (typeof stored === "string" && stored.length > 0 && !isBcryptHash(stored)) {
                    const hashed = await hashPassword(stored, rounds);
                    await model.updateOne({ _id: doc._id }, { $set: { password: hashed } });
                    migrated++;
                }
            }
        } catch (err) {
            console.warn(`[Security] Migrasi password ${label} gagal:`, err.message);
        }
        if (migrated > 0) {
            log(`[Security] Password ${label} dimigrasikan ke bcrypt: ${migrated} akun`);
        }
        total += migrated;
    }
    return total;
}

export default migratePlaintextPasswords;
