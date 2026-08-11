/**
 * Company Limits — SMART Kasir Server (SP-029 M2, Rule 17).
 *
 * Enforcement sisi server untuk konfigurasi produk yang dikendalikan Master
 * Platform (master.e-profit.id → Company):
 *   - jumlahGudang  → batas maksimal gudang yang boleh dibuat
 *   - jumlahKasir   → batas maksimal user ber-role kasir
 *   - lokasiMode    → single = transfer antar gudang dinonaktifkan
 *   - lisensiStatus → active/trial/expired (info; entitlement terpisah)
 *
 * POS HANYA membaca konfigurasi (Rule 4 & 17) — tidak mengelola. Semua fungsi
 * murni (testable) dan dipakai route master data (warehouse/users/transfer).
 *
 * @module pos/server/services/company-limits
 */

import { Company } from "../models/Company.js";
import { normalizeCompanyConfig } from "./company-config.js";

/**
 * Muat konfigurasi company dari DB bersama (ditulis Master Platform).
 * @param {string} companyCode
 * @returns {Promise<object>} Konfigurasi ternormalisasi (default aman bila company tidak ditemukan)
 */
export async function loadCompanyConfig(companyCode) {
    if (!companyCode) return normalizeCompanyConfig({});
    try {
        const company = await Company.findOne({ code: companyCode }).lean();
        return normalizeCompanyConfig(company);
    } catch (err) {
        console.warn(`[CompanyLimits] Gagal memuat konfigurasi company ${companyCode}:`, err?.message);
        return normalizeCompanyConfig({});
    }
}

/**
 * Cek kuota gudang (jumlahGudang).
 * @param {object} config Konfigurasi ternormalisasi
 * @param {number} currentCount Jumlah gudang aktif saat ini
 * @returns {{ allowed: boolean, limit: number, current: number, remaining: number, message?: string }}
 */
export function checkGudangLimit(config, currentCount) {
    const limit = Math.max(1, parseInt(config?.jumlahGudang, 10) || 1);
    const current = Math.max(0, parseInt(currentCount, 10) || 0);
    if (current < limit) {
        return { allowed: true, limit, current, remaining: limit - current };
    }
    return {
        allowed: false,
        limit,
        current,
        remaining: 0,
        message: `Kuota gudang tercapai (${current}/${limit}).`
    };
}

/**
 * Cek kuota kasir (jumlahKasir) — hanya untuk user ber-role kasir.
 * @param {object} config Konfigurasi ternormalisasi
 * @param {number} currentCount Jumlah user role kasir aktif saat ini
 * @returns {{ allowed: boolean, limit: number, current: number, remaining: number, message?: string }}
 */
export function checkKasirLimit(config, currentCount) {
    const limit = Math.max(1, parseInt(config?.jumlahKasir, 10) || 1);
    const current = Math.max(0, parseInt(currentCount, 10) || 0);
    if (current < limit) {
        return { allowed: true, limit, current, remaining: limit - current };
    }
    return {
        allowed: false,
        limit,
        current,
        remaining: 0,
        message: `Kuota kasir tercapai (${current}/${limit}).`
    };
}

/**
 * Mode lokasi — transfer antar gudang hanya aktif untuk multi lokasi.
 * @param {string} lokasiMode "single" | "multi"
 * @returns {boolean}
 */
export function canTransfer(lokasiMode) {
    return lokasiMode === "multi";
}

/**
 * Pesan standar saat transfer ditolak karena mode Single Lokasi.
 * @returns {string}
 */
export function singleLocationTransferMessage() {
    return "Mode Single Lokasi aktif — transfer antar gudang tidak tersedia.";
}

export default {
    loadCompanyConfig,
    checkGudangLimit,
    checkKasirLimit,
    canTransfer,
    singleLocationTransferMessage
};
