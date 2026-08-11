/**
 * Transfer Model — Stock Transfer Antar Gudang.
 *
 * Simple model: gudang asal → gudang tujuan, items tanpa harga.
 * Status: draft → transferred
 * Saat transferred: stok barang berkurang di gudang asal.
 *
 * @module server/models/Transfer
 */

import mongoose from "mongoose";

const transferItemSchema = new mongoose.Schema({
    kodeBarang: { type: String, default: "" },
    namaBarang: { type: String, default: "" },
    qty: { type: Number, required: true, min: 1 },
    satuan: { type: String, default: "" }
}, { _id: false });

const transferSchema = new mongoose.Schema({
    companyCode: { type: String, required: true },
    nomor: { type: String, required: true },
    tanggal: { type: Date, default: Date.now },
    gudangAsal: { type: String, required: true },
    gudangAsalNama: { type: String, default: "" },
    gudangTujuan: { type: String, required: true },
    gudangTujuanNama: { type: String, default: "" },
    items: [transferItemSchema],
    catatan: { type: String, default: "" },
    status: { type: String, default: "draft", enum: ["draft", "transferred"] },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

transferSchema.index({ companyCode: 1, createdAt: -1 });
transferSchema.index({ companyCode: 1, nomor: 1 }, { unique: true });

/**
 * Generate nomor transfer: TRF-DDMMYYYY-XXXX
 * Reset counter per tahun.
 */
transferSchema.statics.generateNomor = async function (companyCode) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const prefix = `TRF-${dd}${mm}${yyyy}-`;

    const yearStart = new Date(yyyy, 0, 1);
    const yearEnd = new Date(yyyy + 1, 0, 1);
    const last = await this.findOne({
        companyCode,
        nomor: { $regex: `^TRF-\\d{8}-` },
        createdAt: { $gte: yearStart, $lt: yearEnd }
    }).sort({ nomor: -1 });

    let nextSeq = 1;
    if (last) {
        const parts = last.nomor.split("-");
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }

    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
};

export const Transfer = mongoose.model("Transfer", transferSchema);
