import mongoose from "mongoose";

const barangSchema = new mongoose.Schema({
    companyCode: { type: String, required: true },
    tenantId: { type: String, default: null },
    kode: { type: String, required: true },
    nama: { type: String, required: true },
    kategori: { type: String, default: "" },
    satuan: { type: String, default: "" },
    rak: { type: String, default: "" },
    gudang: { type: String, default: "" },
    harga_beli: { type: Number, default: 0 },
    harga_jual: { type: Number, default: 0 },
    // SP-027 PRE-M5 round 6 (PRD V1): harga khusus (1 tier multi price) —
    // dipakai layar kasir bila terisi (> 0), fallback harga_jual. Additive.
    harga_khusus: { type: Number, default: 0 },
    // PRD V1 (POS Core): barcode item — untuk search & scanner kasir.
    barcode: { type: String, default: "" },
    stok: { type: Number, default: 0 },
    stok_minimum: { type: Number, default: 0 },
    // SP-029 M3 — tipe barang (Inventory Behavior, PRD V1):
    //   trading      → fisik, kurangi stok saat terjual
    //   service      → jasa, TIDAK memakai stok
    //   recipe       → resep (V1: dijual tanpa kurangi stok; engine penuh V2)
    //   manufactured → produksi (placeholder, engine V2)
    //   digital      → produk digital (placeholder, engine V3)
    // Backward compatible (enum diperluas, bukan diganti).
    behavior: { type: String, default: "trading", enum: ["trading", "service", "recipe", "manufactured", "digital"] },
    // SP-029 M3 — foto produk (opsional, dipakai layar kasir).
    foto: { type: String, default: "" },
    deskripsi: { type: String, default: "" },
    active: { type: Boolean, default: true },
    status: { type: String, default: "active", enum: ["active", "inactive", "archived"] },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

export const Barang = mongoose.model("Barang", barangSchema);
