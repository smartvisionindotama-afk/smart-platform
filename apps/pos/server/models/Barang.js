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
    //   recipe       → resep MODEL SIMPLE (tanpa stok; penyesuaian stok
    //                  dilakukan manual via stok opname — TIDAK dikonsumsi
    //                  realtime saat transaksi)
    //   recipe-fnb   → resep TERHUBUNG Recipe F&B (M6.2): bahan dikonsumsi
    //                  realtime saat produk terjual (engine BOM)
    //   manufactured → produksi (placeholder, engine V2)
    //   digital      → produk digital (placeholder, engine V3)
    // Backward compatible (enum diperluas, bukan diganti).
    behavior: { type: String, default: "trading", enum: ["trading", "service", "recipe", "recipe-fnb", "manufactured", "digital"] },
    // M6.2-FIX v0.40 — "Dijual / Tidak Dijual" (M6.2): barang yang TIDAK
    // dijual (mis. gula/rempah — ingredient resep F&B) tetap ada di daftar
    // barang untuk melengkapi recipe tapi TIDAK tampil di layar kasir.
    // Default true (backward compat — data lama tetap dijual). Field
    // additive; kolom ini hanya ditampilkan bila company mengaktifkan F&B
    // (transactionTypes includes "fnb" — diatur superadmin master.e-profit.id).
    dijual: { type: Boolean, default: true },
    // M6.2-FIX v0.43 — VARIAN produk ala marketplace (trading & resep simple):
    //   varianDef: dimensi varian, mis. [{ nama: "Ukuran", nilai: ["S","M"] },
    //              { nama: "Warna", nilai: ["Merah","Biru"] }]
    //   skus:      tiap KOMBINASI dimensi = 1 SKU dengan harga & stok sendiri
    //              (mis. "S / Merah" → harga 50rb, stok 10).
    // Additive: barang tanpa varian = kedua field kosong (perilaku existing
    // tidak berubah). `stok` utama dihitung server = Σ stok seluruh SKU.
    varianDef: {
        type: [{
            nama: { type: String, default: "" },
            nilai: { type: [String], default: [] }
        }],
        default: []
    },
    skus: {
        type: [{
            kode: { type: String, default: "" },      // kode SKU (auto: kodeBarang-nilai)
            label: { type: String, default: "" },     // "S / Merah" (display kasir)
            harga: { type: Number, default: 0, min: 0 }, // harga utk pelanggan UMUM per kombinasi
            // M6.2-FIX — harga khusus per SKU (utk member/pelanggan terdaftar,
            // pola sama dgn harga_khusus produk: dipakai kasir bila > 0).
            harga_khusus: { type: Number, default: 0, min: 0 },
            stok: { type: Number, default: 0, min: 0 },   // stok per kombinasi
            // M6.2-FIX v0.43 — foto per SKU (opsional, data URI hasil kompresi
            // client-side — pola sama dgn foto produk; ditampilkan kasir).
            foto: { type: String, default: "" }
        }],
        default: []
    },
    // SP-029 M3 — foto produk (opsional, dipakai layar kasir).
    foto: { type: String, default: "" },
    deskripsi: { type: String, default: "" },
    active: { type: Boolean, default: true },
    status: { type: String, default: "active", enum: ["active", "inactive", "archived"] },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

export const Barang = mongoose.model("Barang", barangSchema);
