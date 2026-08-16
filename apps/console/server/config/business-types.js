/**
 * Business Type — katalog jenis usaha (SP-029 M2 [USULAN], Rule 9 & 17).
 *
 * Business Type dipilih pada Master Platform (Edit Perusahaan) dan dibaca
 * POS untuk menentukan konfigurasi awal. Perbedaan proses bisnis TETAP
 * dikendalikan Inventory Behavior (Rule 9) — business type hanya konfigurasi.
 *
 * Sumber kebenaran: SERVER ini. Client (apps/console/src/config/index.js)
 * memuat daftar via GET /api/companies/business-types (fallback konstanta
 * yang harus dijaga tetap sinkron).
 *
 * Field transactionTypes (Transaction Capability — SP-029 POS V1) ikut
 * dinormalisasi di sini; validasi ketat (unknown/duplikat ditolak, kosong
 * diizinkan) dilakukan route companies POST/PUT — lihat validateTransactionTypes
 * (registry @smart/core, satu sumber kebenaran).
 *
 * @module console/server/config/business-types
 */

import { validateTransactionTypes } from "../../../../packages/smart-core/src/transaction-types/transaction-types.js";

export const BUSINESS_TYPES = [
    "Retail",
    "Minimarket",
    "Toko Kelontong",
    "Cafe",
    "Coffee Shop",
    "Restoran",
    "Bakery",
    "Pharmacy",
    "Distributor",
    "Manufacturing",
    "Jasa",
    "Lainnya"
];

/**
 * Normalisasi business type — hanya nilai katalog yang diterima (pure).
 * @param {unknown} raw
 * @returns {string} business type valid atau "" (tidak dikenal)
 */
export function normalizeBusinessType(raw) {
    return BUSINESS_TYPES.includes(raw) ? raw : "";
}

/**
 * Normalisasi field konfigurasi produk (pure, dipakai POST/PUT companies).
 * @param {object} data
 * @returns {object} salinan data dengan field config ternormalisasi
 */
export function normalizeCompanyConfigFields(data = {}) {
    const out = { ...data };
    if (out.businessType !== undefined) out.businessType = normalizeBusinessType(out.businessType);
    if (out.lokasiMode !== undefined) {
        out.lokasiMode = ["single", "multi"].includes(out.lokasiMode) ? out.lokasiMode : "single";
    }
    if (out.jumlahGudang !== undefined) out.jumlahGudang = Math.max(1, parseInt(out.jumlahGudang, 10) || 1);
    if (out.jumlahKasir !== undefined) out.jumlahKasir = Math.max(1, parseInt(out.jumlahKasir, 10) || 1);
    if (out.lisensiStatus !== undefined) {
        out.lisensiStatus = ["active", "trial", "expired"].includes(out.lisensiStatus) ? out.lisensiStatus : "active";
    }
    if (out.lisensiExpiresAt !== undefined && out.lisensiExpiresAt === "") {
        out.lisensiExpiresAt = null;
    }
    // Transaction Capability (SP-029 POS V1): bila valid, simpan daftar
    // ternormalisasi (dedupe, urut); bila tidak valid dibiarkan apa adanya
    // — route yang menolak (400) agar error-nya eksplisit.
    if (out.transactionTypes !== undefined) {
        const check = validateTransactionTypes(out.transactionTypes);
        if (check.ok) out.transactionTypes = check.value;
    }
    return out;
}

export default { BUSINESS_TYPES, normalizeBusinessType, normalizeCompanyConfigFields };
