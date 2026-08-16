/**
 * Payment Data Services — Company Payment Settings (F&B V1).
 *
 * QRIS Company + Bank Accounts (maks 3 aktif). Backend /api/company-payment
 * (company scope + permission settings.company.edit).
 *
 * @module pos/data/payment-data
 */

import { apiCall } from "./api.js";

// ── QRIS Company ──

/**
 * Baca QRIS company (null bila belum upload).
 * @returns {Promise<{qris: object|null}>}
 */
export async function getCompanyQris() {
    const res = await apiCall("GET", "/company-payment/qris");
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Upload / update QRIS company.
 * @param {string} qrisImage Data URI (hasil kompresi client)
 * @returns {Promise<object>}
 */
export async function saveCompanyQris(qrisImage) {
    const res = await apiCall("PUT", "/company-payment/qris", { qrisImage });
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/** Nonaktifkan QRIS company. @returns {Promise<object>} */
export async function disableCompanyQris() {
    const res = await apiCall("POST", "/company-payment/qris/disable");
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

// ── Bank Accounts ──

/**
 * Daftar rekening bank company.
 * @returns {Promise<{data: object[]}>}
 */
export async function listBankAccounts() {
    const res = await apiCall("GET", "/company-payment/bank-accounts");
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Tambah rekening (maks 3 aktif — server menolak lebih).
 * @param {{ bankName: string, accountNumber: string, accountName: string, active?: boolean }} data
 * @returns {Promise<object>}
 */
export async function createBankAccount(data) {
    const res = await apiCall("POST", "/company-payment/bank-accounts", data);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Ubah rekening.
 * @param {string} id
 * @param {{ bankName: string, accountNumber: string, accountName: string, active?: boolean }} data
 * @returns {Promise<object>}
 */
export async function updateBankAccount(id, data) {
    const res = await apiCall("PUT", `/company-payment/bank-accounts/${id}`, data);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/** Hapus rekening. @param {string} id */
export async function deleteBankAccount(id) {
    const res = await apiCall("DELETE", `/company-payment/bank-accounts/${id}`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}
