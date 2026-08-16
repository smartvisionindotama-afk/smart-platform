/**
 * Company Config — SMART Kasir Client (SP-029 M2, Rule 4 & 17).
 *
 * Konfigurasi produk dari Master Platform (master.e-profit.id) diterima lewat
 * response login/impersonate (field `companyConfig`) dan disimpan di
 * sessionStorage oleh token hook (apps/pos/src/main.js).
 *
 * Modul ini menyediakan akses shared untuk halaman (mis. Gudang & User) agar
 * pembatasan kuota (jumlahGudang / jumlahKasir) dan mode lokasi bisa
 * ditampilkan & di-enforce di UI — tanpa hardcode di POS.
 *
 * @module pos/config/company-config
 */

import { apiCall } from "../data/api.js";
import {
    DEFAULT_TRANSACTION_TYPES,
    isTransactionTypeEnabled as isCapabilityEnabled,
    normalizeTransactionTypes
} from "@smart/core";

const COMPANY_CONFIG_KEY = "smart_company_config";

/**
 * Baca konfigurasi perusahaan dari sessionStorage.
 * @returns {object} Konfigurasi ternormalisasi (default aman bila kosong)
 */
export function getCompanyConfig() {
    try {
        const raw = sessionStorage.getItem(COMPANY_CONFIG_KEY);
        if (raw) return normalizeCompanyConfig(JSON.parse(raw) || {});
    } catch { /* ignore */ }
    return normalizeCompanyConfig({});
}

/**
 * Simpan konfigurasi perusahaan ke sessionStorage.
 * @param {object} [config]
 */
export function saveCompanyConfig(config) {
    try {
        if (config) sessionStorage.setItem(COMPANY_CONFIG_KEY, JSON.stringify(config));
        else sessionStorage.removeItem(COMPANY_CONFIG_KEY);
    } catch { /* ignore */ }
}

/**
 * Muat ulang konfigurasi company dari server (GET /api/settings — Company doc
 * ditulis Master Platform). Memperbarui sessionStorage agar kuota gudang/kasir
 * & banner selalu fresh, tidak bergantung cache saat login.
 * Aman dipanggil berulang: bila server down / gagal, cache lama tetap dipakai.
 * @returns {Promise<object>} Konfigurasi ternormalisasi (terbaru / cache)
 */
export async function refreshCompanyConfig() {
    try {
        const res = await apiCall("GET", "/settings");
        if (res && res.companyConfig) {
            saveCompanyConfig(res.companyConfig);
        }
    } catch (err) {
        console.warn("[CompanyConfig] Gagal refresh konfigurasi — pakai cache:", err?.message);
    }
    return getCompanyConfig();
}

/**
 * Normalisasi konfigurasi — mirror helper server (default aman, clamp >= 1).
 * @param {object} [raw]
 * @returns {object}
 */
export function normalizeCompanyConfig(raw = {}) {
    const src = raw || {};
    const lokasiMode = ["single", "multi"].includes(src.lokasiMode) ? src.lokasiMode : "single";
    const lisensiStatus = ["active", "trial", "expired"].includes(src.lisensiStatus) ? src.lisensiStatus : "active";
    return {
        businessType: src.businessType || "",
        lokasiMode,
        jumlahGudang: Math.max(1, parseInt(src.jumlahGudang, 10) || 1),
        jumlahKasir: Math.max(1, parseInt(src.jumlahKasir, 10) || 1),
        lisensiStatus,
        lisensiExpiresAt: src.lisensiExpiresAt || null,
        // Transaction Capability (SP-029 POS V1) — backward compatible:
        // company lama tanpa field → default V1 ["retail"] (perilaku POS
        // saat ini). Array kosong yang tersimpan eksplisit dipertahankan.
        transactionTypes: Array.isArray(src.transactionTypes)
            ? normalizeTransactionTypes(src.transactionTypes)
            : [...DEFAULT_TRANSACTION_TYPES]
    };
}

/**
 * Daftar transaction capability yang diaktifkan perusahaan.
 * @returns {string[]}
 */
export function getEnabledTransactionTypes() {
    return getCompanyConfig().transactionTypes || [...DEFAULT_TRANSACTION_TYPES];
}

/**
 * Apakah sebuah transaction capability aktif untuk perusahaan ini?
 * @param {string} key Key capability (mis. "retail", "fnb")
 * @returns {boolean}
 */
export function isTransactionTypeEnabled(key) {
    return isCapabilityEnabled(getCompanyConfig().transactionTypes, key);
}

/**
 * Label human-readable status lisensi.
 * @param {string} status
 * @returns {string}
 */
export function lisensiLabel(status) {
    switch (status) {
        case "active": return "Active";
        case "trial": return "Trial";
        case "expired": return "Expired";
        default: return "Active";
    }
}

/**
 * Filter menu berdasarkan mode lokasi (single → sembunyikan Transfer Gudang).
 * Pure — mirror helper server (digunakan main.js & test).
 * @param {Array} items Struktur menu (title/icon/page/children)
 * @param {string} lokasiMode "single" | "multi"
 * @returns {Array}
 */
export function filterMenusByLokasi(items, lokasiMode) {
    const single = lokasiMode !== "multi";
    const walk = (list) => list.reduce((acc, item) => {
        if (item.children && item.children.length > 0) {
            const children = walk(item.children);
            if (children.length > 0) acc.push({ ...item, children });
            return acc;
        }
        if (single && item.page === "transfer") return acc;
        acc.push(item);
        return acc;
    }, []);
    return walk(items);
}

export default {
    getCompanyConfig,
    saveCompanyConfig,
    refreshCompanyConfig,
    normalizeCompanyConfig,
    getEnabledTransactionTypes,
    isTransactionTypeEnabled,
    lisensiLabel,
    filterMenusByLokasi
};
