/**
 * Setting Model — pengaturan lokal aplikasi per perusahaan.
 *
 * Konfigurasi yang TIDAK dikelola Master Platform (bukan Company config)
 * disimpan di sini, scoped per companyCode. Contoh: pajak transaksi kasir
 * (taxEnabled) yang diatur Admin di menu Transaksi → Penjualan (M3-FIX v19).
 *
 * @module server/models/Setting
 */

import mongoose from "mongoose";

const settingSchema = new mongoose.Schema({
    companyCode: { type: String, required: true, unique: true, index: true },
    // Pajak transaksi POS aktif/nonaktif (diatur Admin — kasir tidak bisa ubah)
    taxEnabled: { type: Boolean, default: true },
    // ── M3-FIX v21 — Gudang-Kasir (PRD V1 §X) ──
    // Pilihan gudang yang terhubung dengan kasir, diatur Admin di
    // Transaksi → Penjualan. Bila jumlah kasir == 1 → gudangTerkoneksi
    // (daftar kode gudang yang terhubung). Bila kasir > 1 DAN gudang > 1
    // → gudangKasir (mapping per kasir: setiap kasir terhubung 1 gudang).
    gudangTerkoneksi: { type: [String], default: [] },
    gudangKasir: [{
        kasir:      { type: String, default: "" },  // username kasir
        namaKasir:  { type: String, default: "" },
        kodeGudang: { type: String, default: "" },
        namaGudang: { type: String, default: "" }
    }],
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

export const Setting = mongoose.model("Setting", settingSchema);
