/**
 * ReturPembelian Model — Purchase Return.
 *
 * Mencatat pengembalian barang ke supplier, merujuk pada Purchase Order (PO) asli.
 * Status lifecycle: draft → returned
 * - draft:    Baru dibuat, bisa diedit
 * - returned: Barang dikembalikan ke supplier, stok berkurang otomatis
 *
 * @module server/models/ReturPembelian
 */

import mongoose from "mongoose";

const returPembelianItemSchema = new mongoose.Schema({
    kode:      { type: String, required: true },
    nama:      { type: String, required: true },
    satuan:    { type: String, default: "" },
    qty:       { type: Number, required: true, min: 0 },
    harga:     { type: Number, default: 0, min: 0 },
    subtotal:  { type: Number, default: 0, min: 0 }
}, { _id: false });

const returPembelianSchema = new mongoose.Schema({
    companyCode:  { type: String, required: true, index: true },
    nomor:        { type: String, required: true, unique: true },
    tanggal:      { type: Date, default: Date.now },
    nomorPO:      { type: String, default: "" },
    idPO:         { type: String, default: "" },
    supplier:     { type: String, default: "" },
    supplierName: { type: String, default: "" },
    items:        { type: [returPembelianItemSchema], default: [] },
    total:        { type: Number, default: 0, min: 0 },
    catatan:      { type: String, default: "" },
    status:       { type: String, default: "draft", enum: ["draft", "returned"] },
    createdBy:    { type: String, default: null },
    updatedBy:    { type: String, default: null }
}, { timestamps: true });

returPembelianSchema.index({ companyCode: 1, nomor: 1 }, { unique: true });

/**
 * Auto-generate nomor format: RPB-{DD}{MM}{YYYY}-{XXXX}
 * Sequential per tahun, reset hanya saat tahun berganti.
 */
returPembelianSchema.statics.generateNomor = async function (companyCode) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const displayPrefix = `RPB-${dd}${mm}${yyyy}-`;

    const yearPattern = `^RPB-\\d{4}${yyyy}-`;
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

export const ReturPembelian = mongoose.model("ReturPembelian", returPembelianSchema);
