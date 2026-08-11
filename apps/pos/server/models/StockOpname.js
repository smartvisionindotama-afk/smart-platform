/**
 * StockOpname Model — Stock Opname / Physical Count.
 *
 * Mencatat stok opname (perhitungan stok fisik) untuk validasi kesesuaian
 * antara stok sistem dengan stok fisik di gudang.
 *
 * Status lifecycle: draft → in_progress → completed → (cancelled any time)
 * - draft:       Baru dibuat, bisa diedit
 * - in_progress: Sedang proses penghitungan
 * - completed:   Selesai, selisih sudah di-reconcile (stok sistem disesuaikan)
 * - cancelled:   Dibatalkan
 *
 * @module server/models/StockOpname
 */

import mongoose from "mongoose";

const stockOpnameItemSchema = new mongoose.Schema({
    kode:         { type: String, required: true },
    nama:         { type: String, required: true },
    satuan:       { type: String, default: "" },
    gudang:       { type: String, default: "" },
    rak:          { type: String, default: "" },
    stokSistem:   { type: Number, required: true, min: 0 },
    stokFisik:    { type: Number, default: 0, min: 0 },
    selisih:      { type: Number, default: 0 }, // stokFisik - stokSistem
    keterangan:   { type: String, default: "" }
}, { _id: false });

const stockOpnameSchema = new mongoose.Schema({
    companyCode:  { type: String, required: true, index: true },
    nomor:        { type: String, required: true, unique: true },
    tanggal:      { type: Date, default: Date.now },
    gudang:       { type: String, default: "" },
    gudangNama:   { type: String, default: "" },
    keterangan:   { type: String, default: "" },
    items:        { type: [stockOpnameItemSchema], default: [] },
    totalItem:    { type: Number, default: 0 },
    totalSelisih: { type: Number, default: 0 }, // jumlah total selisih (positif + negatif)
    status:       { type: String, default: "draft", enum: ["draft", "in_progress", "completed", "cancelled"] },
    completedAt:  { type: Date, default: null },
    completedBy:  { type: String, default: null },
    createdBy:    { type: String, default: null },
    updatedBy:    { type: String, default: null }
}, { timestamps: true });

stockOpnameSchema.index({ companyCode: 1, nomor: 1 }, { unique: true });

/**
 * Auto-generate nomor format: SO-{DD}{MM}{YYYY}-{XXXX}
 * XXXX is sequential per year (4 digit), reset only when year changes.
 *
 * @param {string} companyCode
 * @returns {string} nomor
 */
stockOpnameSchema.statics.generateNomor = async function (companyCode) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const displayPrefix = `SO-${dd}${mm}${yyyy}-`;

    // Find the highest seq number for this company + year
    const yearPattern = `^SO-\\\\d{4}${yyyy}-`;
    const last = await this.findOne({
        companyCode,
        nomor: { $regex: yearPattern }
    }).sort({ nomor: -1 }).select("nomor").lean();

    let seq = 1;
    if (last && last.nomor) {
        const parts = last.nomor.split("-");
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${displayPrefix}${String(seq).padStart(4, "0")}`;
};

export const StockOpname = mongoose.model("StockOpname", stockOpnameSchema);
