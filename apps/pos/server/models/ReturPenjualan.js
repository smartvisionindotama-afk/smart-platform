/**
 * ReturPenjualan Model — Sales Return (reuse engine Inventory, PRD V1 §7.8).
 *
 * Mencatat pengembalian barang dari pelanggan, merujuk pada transaksi penjualan
 * asal — Sales Order (SO, `sumber: "so"`) maupun transaksi kasir (KWT,
 * `sumber: "pos"`).
 * Status lifecycle: draft → returned
 * - draft:    Baru dibuat, bisa diedit
 * - returned: Barang diterima kembali dari pelanggan, stok trading bertambah otomatis
 *             (item service/recipe/dll TIDAK memengaruhi stok)
 *
 * @module server/models/ReturPenjualan
 */

import mongoose from "mongoose";

const returPenjualanItemSchema = new mongoose.Schema({
    kode:      { type: String, required: true },
    nama:      { type: String, required: true },
    satuan:    { type: String, default: "" },
    qty:       { type: Number, required: true, min: 0 },
    harga:     { type: Number, default: 0, min: 0 },
    subtotal:  { type: Number, default: 0, min: 0 }
}, { _id: false });

const returPenjualanSchema = new mongoose.Schema({
    companyCode:   { type: String, required: true, index: true },
    nomor:         { type: String, required: true, unique: true },
    tanggal:       { type: Date, default: Date.now },
    nomorSO:       { type: String, default: "" },
    idSO:          { type: String, default: "" },
    // PRD V1 §7.8 — sumber transaksi asal: "so" (Sales Order) atau "pos"
    // (transaksi kasir KWT). Additive; retur dari keduanya didukung engine.
    sumber:        { type: String, default: "so", enum: ["so", "pos"] },
    pelanggan:     { type: String, default: "" },
    pelangganNama: { type: String, default: "" },
    items:         { type: [returPenjualanItemSchema], default: [] },
    total:         { type: Number, default: 0, min: 0 },
    catatan:       { type: String, default: "" },
    status:        { type: String, default: "draft", enum: ["draft", "returned"] },
    createdBy:     { type: String, default: null },
    updatedBy:     { type: String, default: null }
}, { timestamps: true });

returPenjualanSchema.index({ companyCode: 1, nomor: 1 }, { unique: true });

/**
 * Auto-generate nomor format: RPJ-{DD}{MM}{YYYY}-{XXXX}
 * Sequential per tahun, reset hanya saat tahun berganti.
 */
returPenjualanSchema.statics.generateNomor = async function (companyCode) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const displayPrefix = `RPJ-${dd}${mm}${yyyy}-`;

    const yearPattern = `^RPJ-\\d{4}${yyyy}-`;
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

export const ReturPenjualan = mongoose.model("ReturPenjualan", returPenjualanSchema);
