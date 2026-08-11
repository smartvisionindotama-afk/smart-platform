/**
 * Pembelian Model — Purchase Order (PO).
 *
 * Mencatat pembelian barang dari supplier dengan multi-item.
 * Status lifecycle: draft → confirmed → received → (cancelled any time).
 *
 * @module server/models/Pembelian
 */

import mongoose from "mongoose";

const pembelianItemSchema = new mongoose.Schema({
    kode:      { type: String, required: true },
    nama:      { type: String, required: true },
    satuan:    { type: String, default: "" },
    qty:       { type: Number, required: true, min: 0 },
    harga:     { type: Number, required: true, min: 0 },
    diskon:    { type: Number, default: 0, min: 0 },
    subtotal:  { type: Number, required: true, min: 0 }
}, { _id: false });

const pembelianSchema = new mongoose.Schema({
    companyCode: { type: String, required: true, index: true },
    nomor:       { type: String, required: true, unique: true },
    tanggal:     { type: Date, default: Date.now },
    supplier:    { type: String, required: true },
    supplierName:{ type: String, default: "" },
    kirimKe:     { type: String, default: "" },
    kirimKeNama: { type: String, default: "" },
    items:       { type: [pembelianItemSchema], default: [] },
    total:       { type: Number, default: 0, min: 0 },
    diskon:      { type: Number, default: 0, min: 0 },
    grandTotal:  { type: Number, default: 0, min: 0 },
    catatan:     { type: String, default: "" },
    status:      { type: String, default: "draft", enum: ["draft", "confirmed", "received", "cancelled"] },
    createdBy:   { type: String, default: null },
    updatedBy:   { type: String, default: null }
}, { timestamps: true });

pembelianSchema.index({ companyCode: 1, nomor: 1 }, { unique: true });

/**
 * Auto-generate nomor PO format: PO-DDMMYYYY-XXXX
 * XXXX is sequential per year (4 digit), reset only when year changes.
 * Format tampil: PO-{DD}{MM}{YYYY}-{XXXX}
 * Counter: sequential berdasarkan tahun, bukan per hari.
 */
pembelianSchema.statics.generateNomor = async function (companyCode) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const displayPrefix = `PO-${dd}${mm}${yyyy}-`;

    // Find the highest seq number for this company + year (any date in the year)
    // Regex: PO-diikuti 4 digit (DDMM) + YYYY + -
    const yearPattern = `^PO-\\d{4}${yyyy}-`;
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

export const Pembelian = mongoose.model("Pembelian", pembelianSchema);
