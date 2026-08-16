/**
 * Transaction Capability — SMART Kasir Server (SP-029 POS V1).
 *
 * Enforcement capability jenis transaksi di sisi BACKEND (bukan hanya
 * hide/show UI). Sumber kebenaran daftar capability: registry @smart/core
 * (transaction-types). Sumber kebenaran config per perusahaan:
 * Company.transactionTypes (dokumen Company — DB bersama Console).
 *
 * Fitur:
 *   - getCompanyTransactionTypes      : baca daftar enabled (fallback default V1)
 *   - requireTransactionType(type)    : middleware Express — tolak request bila
 *     capability perusahaan tidak mengaktifkan jenis transaksi tsb (403)
 *   - checkTransactionTypeEnabled     : helper murni (testable)
 *
 * @module pos/server/services/transaction-capability
 */

import { Company } from "../models/Company.js";
import {
    DEFAULT_TRANSACTION_TYPES,
    getTransactionTypeMeta,
    isKnownTransactionType,
    normalizeTransactionTypes,
    validateTransactionTypes
} from "../../../../packages/smart-core/src/transaction-types/transaction-types.js";

/**
 * Baca daftar transaction capability yang diaktifkan untuk perusahaan
 * (fallback aman: company lama tanpa field → default V1 ["retail"]).
 * @param {string} companyCode
 * @returns {Promise<string[]>}
 */
export async function getCompanyTransactionTypes(companyCode) {
    if (!companyCode) return [...DEFAULT_TRANSACTION_TYPES];
    const company = await Company.findOne({ code: companyCode }).select("transactionTypes").lean();
    if (!company) return [...DEFAULT_TRANSACTION_TYPES];
    return Array.isArray(company.transactionTypes)
        ? normalizeTransactionTypes(company.transactionTypes)
        : [...DEFAULT_TRANSACTION_TYPES];
}

/**
 * Helper murni — apakah capability aktif pada daftar enabled?
 * @param {string[]|undefined|null} enabled Daftar capability yang diaktifkan
 * @param {string} key Key capability
 * @returns {boolean}
 */
export function checkTransactionTypeEnabled(enabled, key) {
    if (!isKnownTransactionType(key)) return false;
    const list = Array.isArray(enabled) ? enabled : DEFAULT_TRANSACTION_TYPES;
    return list.includes(key);
}

/**
 * Parse payload PUT transaction capabilities — menerima DUA bentuk:
 *   A (kanonik, M6.1-V1): { transactionTypes: ["retail", "fnb"] }
 *   B (M6 object boolean): { retail: true, fnb: true, service: false, ppob: false }
 * Keduanya dinormalisasi ke daftar array. Validasi:
 *   - capability tidak dikenal → ditolak
 *   - nilai bukan boolean (bentuk B) → ditolak
 *   - duplikat (bentuk A) → ditolak
 *   - array kosong / semua false → diperbolehkan
 * @param {unknown} raw Body PUT mentah
 * @returns {{ok: true, value: string[]} | {ok: false, error: string}}
 */
export function parseTransactionCapabilitiesPayload(raw) {
    if (raw && typeof raw === "object" && !Array.isArray(raw) && "transactionTypes" in raw) {
        return validateTransactionTypes(raw.transactionTypes);
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const keys = Object.keys(raw);
        if (keys.length === 0) return { ok: true, value: [] };
        for (const k of keys) {
            if (!isKnownTransactionType(k)) {
                return { ok: false, error: `Capability "${k}" tidak dikenal` };
            }
            if (typeof raw[k] !== "boolean") {
                return { ok: false, error: `Nilai capability "${k}" harus boolean` };
            }
        }
        return { ok: true, value: keys.filter(k => raw[k] === true) };
    }
    return { ok: false, error: "transactionTypes harus berupa array" };
}

/**
 * Factory middleware Express: tolak request bila perusahaan (scope dari header
 * x-company-code) tidak mengaktifkan jenis transaksi `type`.
 *
 * Dependency injection `getTypes` (default: getCompanyTransactionTypes) agar
 * bisa di-unit-test tanpa database.
 *
 * @param {string} type Key capability (mis. "retail")
 * @param {{ getTypes?: (companyCode: string) => Promise<string[]> }} [opts]
 * @returns {import("express").RequestHandler}
 */
export function requireTransactionType(type, opts = {}) {
    const getTypes = typeof opts.getTypes === "function" ? opts.getTypes : getCompanyTransactionTypes;
    return async (req, res, next) => {
        try {
            const companyCode = req.headers["x-company-code"];
            if (!companyCode) {
                return res.status(400).json({ error: "Company code required" });
            }
            const enabled = await getTypes(companyCode);
            if (!checkTransactionTypeEnabled(enabled, type)) {
                const meta = getTransactionTypeMeta(type);
                return res.status(403).json({
                    error: `Jenis transaksi "${meta ? meta.label : type}" tidak aktif untuk perusahaan ini. Aktifkan di konfigurasi perusahaan (Transaction Capability).`
                });
            }
            next();
        } catch (err) {
            next(err);
        }
    };
}

export default {
    getCompanyTransactionTypes,
    checkTransactionTypeEnabled,
    parseTransactionCapabilitiesPayload,
    requireTransactionType
};
