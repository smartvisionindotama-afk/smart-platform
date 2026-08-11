/**
 * BarangGudang Model — Stock per Warehouse.
 *
 * Setiap record = stok 1 barang di 1 gudang.
 * Source of truth untuk stok per gudang.
 *
 * @module server/models/BarangGudang
 */

import mongoose from "mongoose";

const barangGudangSchema = new mongoose.Schema({
    companyCode: { type: String, required: true },
    kodeBarang: { type: String, required: true },
    kodeGudang: { type: String, required: true },
    stok: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

barangGudangSchema.index({ companyCode: 1, kodeBarang: 1, kodeGudang: 1 }, { unique: true });

export const BarangGudang = mongoose.model("BarangGudang", barangGudangSchema);
