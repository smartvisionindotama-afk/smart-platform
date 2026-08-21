/**
 * Barang Page — Thin wrapper around BarangModule.
 *
 * M6.2-FIX v0.40 — kolom/field "Dijual / Tidak Dijual" hanya tampil bila
 * company mengaktifkan capability F&B (transactionTypes includes "fnb" —
 * diatur superadmin di master.e-profit.id). Tanpa F&B (retail/jasa saja)
 * kolom disembunyikan. App lain (inventory) tidak meneruskan opsi ini →
 * default false.
 */
import { InventoryBarang as BarangModule } from "@smart/inventory-ui";
import {
    listBarang, getBarang, createBarang, updateBarang, deleteBarang,
    listKategori, listSatuan, listRak, listWarehouse,
    createKategori, createSatuan, createRak,
    formatRupiah, checkKodeExists
} from "../../data/index.js";
import { isTransactionTypeEnabled } from "../../config/company-config.js";

const { BarangPage, initBarangPage } = BarangModule({
    listBarang, getBarang, createBarang, updateBarang, deleteBarang,
    listKategori, listSatuan, listRak, listWarehouse,
    createKategori, createSatuan, createRak,
    formatRupiah, checkKodeExists
}, {
    // POS — hanya tampilkan kolom Dijual/Tidak Dijual saat F&B aktif
    showDijual: isTransactionTypeEnabled("fnb"),
    // POS mendukung varian untuk semua tipe barang
    varianBehaviorOptions: ["trading", "service", "recipe", "recipe-fnb"]
});

export { BarangPage, initBarangPage };
