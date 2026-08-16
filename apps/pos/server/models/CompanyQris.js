/**
 * CompanyQris Model — QRIS Company (F&B Payment V1).
 *
 * QRIS milik COMPANY (diupload admin Settings → Company → Payment Settings),
 * BUKAN QRIS milik SMART VISION. Hanya QRIS yang status-nya active yang
 * ditampilkan pada halaman payment customer.
 *
 * `qrisImage` = data URI hasil upload (pola sama dengan logo/foto produk).
 * Satu dokumen per company (upsert saat upload baru).
 *
 * @module server/models/CompanyQris
 */

import mongoose from "mongoose";

const companyQrisSchema = new mongoose.Schema({
    companyCode: { type: String, required: true, unique: true, index: true },
    qrisImage:   { type: String, default: "" },
    active:      { type: Boolean, default: true },
    updatedBy:   { type: String, default: null }
}, { timestamps: true });

export const CompanyQris = mongoose.model("CompanyQris", companyQrisSchema);
