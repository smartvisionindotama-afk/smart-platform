/**
 * QR Menu Data Services — F&B Customer Ordering V1 (admin).
 *
 * CRUD meja + generate link QR permanen (admin Settings/F&B → QR Menu Meja).
 * Backend: /api/qr-tables (company scope + permission pos.qr.manage utk tulis).
 *
 * @module pos/data/qr-menu-data
 */

import { apiCall } from "./api.js";

/**
 * Daftar meja QR (company scope).
 * @returns {Promise<{data: object[]}>}
 */
export async function listQrTables() {
    const res = await apiCall("GET", "/qr-tables");
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Tambah meja baru.
 * @param {{ nomorMeja: string, lokasiId?: string }} data
 * @returns {Promise<object>}
 */
export async function createQrTable(data) {
    const res = await apiCall("POST", "/qr-tables", data);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Ubah meja (nomor / lokasi). QR identifier TIDAK berubah.
 * @param {string} id
 * @param {{ nomorMeja: string, lokasiId?: string }} data
 * @returns {Promise<object>}
 */
export async function updateQrTable(id, data) {
    const res = await apiCall("PUT", `/qr-tables/${id}`, data);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/** Hapus meja. @param {string} id */
export async function deleteQrTable(id) {
    const res = await apiCall("DELETE", `/qr-tables/${id}`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Buat link QR MENU meja (SEKALI — permanent). Meja yang sudah punya
 * identifier mengembalikan link yang SAMA (cetak ulang tidak membuat baru).
 * @param {string} id
 * @returns {Promise<{qrIdentifier: string, qrLink: string, active: boolean}>}
 */
export async function createQrTableLink(id) {
    const res = await apiCall("POST", `/qr-tables/${id}/qr`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/** Nonaktifkan QR meja (customer lihat "QR Menu tidak aktif"). @param {string} id */
export async function disableQrTable(id) {
    const res = await apiCall("POST", `/qr-tables/${id}/qr/disable`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}
