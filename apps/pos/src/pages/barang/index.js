/**
 * Barang Page — Thin wrapper around BarangModule.
 */
import { InventoryBarang as BarangModule } from "@smart/inventory-ui";
import {
    listBarang, getBarang, createBarang, updateBarang, deleteBarang,
    listKategori, listSatuan, listRak, listWarehouse,
    createKategori, createSatuan, createRak,
    formatRupiah, checkKodeExists
} from "../../data/index.js";

const { BarangPage, initBarangPage } = BarangModule({
    listBarang, getBarang, createBarang, updateBarang, deleteBarang,
    listKategori, listSatuan, listRak, listWarehouse,
    createKategori, createSatuan, createRak,
    formatRupiah, checkKodeExists
});

export { BarangPage, initBarangPage };
