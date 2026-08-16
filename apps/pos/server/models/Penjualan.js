/**
 * Penjualan Model — Sales Order (SO).
 *
 * Mencatat penjualan barang ke pelanggan dengan multi-item.
 * Status lifecycle: order → delivered → invoiced → paid
 * - order:     Sales Order dibuat, bisa diedit
 * - delivered: Surat Jalan terbit, stock berkurang
 * - invoiced:  Invoice terbit
 * - paid:      Kwitansi terbit, lunas
 *
 * @module server/models/Penjualan
 */

import mongoose from "mongoose";

const penjualanItemSchema = new mongoose.Schema({
    kode:      { type: String, required: true },
    nama:      { type: String, required: true },
    satuan:    { type: String, default: "" },
    qty:       { type: Number, required: true, min: 0 },
    harga:     { type: Number, required: true, min: 0 },
    diskon:    { type: Number, default: 0, min: 0 },
    subtotal:  { type: Number, required: true, min: 0 },
    // M6.2 — referensi produk (Barang._id) utk lookup recipe F&B pada
    // konsumsi bahan. Additive; data lama tanpa field ini tetap valid
    // (consumption fallback mencocokkan productKode recipe).
    productId: { type: String, default: "" },
    // M6.2-FIX v0.42 — referensi VARIAN recipe F&B yang dipilih kasir
    // (Recipe._id). Produk boleh punya beberapa varian aktif; konsumsi bahan
    // memakai ingredient recipe varian ini. Additive — data lama tanpa field
    // tetap valid (fallback ke recipe aktif pertama per produk).
    recipeId: { type: String, default: "" },
    // M6.2-FIX v0.43 — SKU varian produk (marketplace) yang dipilih kasir.
    // Decrement/reversal stok memakai SKU spesifik. Additive — barang tanpa
    // varian tidak membawa field ini.
    skuKode: { type: String, default: "" },
    skuLabel: { type: String, default: "" }
}, { _id: false });

const penjualanSchema = new mongoose.Schema({
    companyCode:   { type: String, required: true, index: true },
    nomor:         { type: String, required: true, unique: true },
    tanggal:       { type: Date, default: Date.now },
    pelanggan:     { type: String, required: true },
    pelangganNama: { type: String, default: "" },
    pelangganAlamat: { type: String, default: "" },
    noPoPelanggan: { type: String, default: "" },
    kirimDari:     { type: String, default: "" },
    kirimDariNama: { type: String, default: "" },
    items:         { type: [penjualanItemSchema], default: [] },
    total:         { type: Number, default: 0, min: 0 },
    diskon:        { type: Number, default: 0, min: 0 },
    grandTotal:    { type: Number, default: 0, min: 0 },
    catatan:       { type: String, default: "" },
    status:        { type: String, default: "order", enum: ["order", "delivered", "invoiced", "paid", "void", "held"] },
    noSuratJalan:  { type: String, default: "" },
    tanggalSJ:     { type: Date, default: null },
    noInvoice:     { type: String, default: "" },
    tanggalInvoice:{ type: Date, default: null },
    noKwitansi:    { type: String, default: "" },
    tanggalKwitansi:{ type: Date, default: null },
    sales:         { type: String, default: "" },
    // ── SP-029 M3 — transaksi POS (kasir) ──
    // sumber: "so" = sales order normal (flow order→delivered→…);
    //         "pos" = penjualan kasir langsung lunas (KWT terbit saat create).
    sumber:        { type: String, default: "so", enum: ["so", "pos"] },
    kasir:         { type: String, default: "" },
    pajak:         { type: Number, default: 0, min: 0 },
    bayar:         { type: Number, default: 0, min: 0 },
    kembalian:     { type: Number, default: 0, min: 0 },
    // ── PRD V1 (POS Core §7.6) — metode pembayaran (extensible) ──
    // cash | transfer | qris | card — enum additive, backward compatible.
    metode_bayar:  { type: String, default: "cash", enum: ["cash", "transfer", "qris", "card"] },
    // ── PRD V1 (§7.5) — void transaksi (permission pos.transaction.void) ──
    // status "void" + reversal stok; alasan void dicatat (audit trail).
    voidedAt:      { type: Date, default: null },
    voidedBy:      { type: String, default: "" },
    voidReason:    { type: String, default: "" },
    // ── PRD V1 (§7.5) — hold/resume transaksi (permission pos.transaction.hold) ──
    // status "held" = keranjang disimpan sementara (belum mengurangi stok),
    // bisa dilanjutkan (→ "order") atau dihapus. Stok TIDAK berubah saat hold.
    heldAt:        { type: Date, default: null },
    heldBy:        { type: String, default: "" },
    heldNote:      { type: String, default: "" },
    // ── M3-FIX v19 — jenis pelanggan kasir (PRD V1 §7.4) ──
    // "umum"  = pelanggan umum → harga normal (harga_jual)
    // "member" = member (Master Member) → berlaku harga khusus (harga_khusus)
    tipePelanggan: { type: String, default: "umum", enum: ["umum", "member"] },
    // ── M3-FIX v21 — Gudang transaksi kasir (PRD V1 §X) ──
    // Gudang yang terhubung dengan kasir saat transaksi dibuat:
    //   kodeGudang = kode warehouse (mis. JWR-001)
    //   gudang     = nama gudang (matching Barang.gudang untuk scoping stok)
    kodeGudang:    { type: String, default: "" },
    gudang:        { type: String, default: "" },
    createdBy:     { type: String, default: null },
    updatedBy:     { type: String, default: null }
}, { timestamps: true });

penjualanSchema.index({ companyCode: 1, nomor: 1 }, { unique: true });

/**
 * Auto-generate nomor format: {prefix}-DDMMYYYY-XXXX (atau DDMMYYYY-XXXX
 * bila prefix kosong — format Nota kasir, M3-FIX v19).
 * XXXX is sequential per year (4 digit), reset only when year changes.
 *
 * @param {string} companyCode
 * @param {string} prefix — "SO" | "SJ" | "INV" | "KWT" | "" (Nota)
 * @returns {string} nomor
 */
penjualanSchema.statics.generateNomor = async function (companyCode, prefix = "SO") {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const displayPrefix = prefix ? `${prefix}-${dd}${mm}${yyyy}-` : `${dd}${mm}${yyyy}-`;

    // Find the highest seq number for this company + year + prefix
    const yearPattern = prefix ? `^${prefix}-\\d{4}${yyyy}-` : `^\\d{4}${yyyy}-`;
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

export const Penjualan = mongoose.model("Penjualan", penjualanSchema);
