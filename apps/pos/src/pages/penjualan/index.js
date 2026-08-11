/**
 * Penjualan Page — Thin wrapper around PenjualanModule.
 *
 * @module inventory/pages/penjualan
 */

import { InventoryPenjualan as PenjualanModule } from "@smart/inventory-ui";
import {
    listPenjualan, getPenjualan, createPenjualan, updatePenjualan,
    deletePenjualan, updatePenjualanStatus,
    voidPenjualan,
    listReturPenjualan, getReturPenjualan, createReturPenjualan,
    updateReturPenjualan, deleteReturPenjualan, updateReturPenjualanStatus,
    listCustomer, listBarang, listWarehouse,
    listSales,
    getCompanyByCode,
    formatRupiah,
    getPosSettings, setPosSettings
} from "../../data/index.js";

/**
 * Fetch company info with full details for invoice printing.
 */
async function getCompanyInfo() {
    try {
        const companyCode =
            (typeof globalThis !== "undefined" && globalThis.SMART?.Session?.get?.("company.code"))
            || (typeof globalThis !== "undefined" && globalThis.SMART?.Company?.getCode?.())
            || null;

        if (companyCode) {
            const company = await getCompanyByCode(companyCode);
            if (company) {
                return {
                    name: company.name || company.companyName,
                    address: company.address || "",
                    phone: company.phone || "",
                    email: company.email || "",
                    logo: company.logo || "",
                    orgBendahara: company.orgBendahara || "",
                    orgKetua: company.orgKetua || ""
                };
            }
        }
    } catch (e) {
        console.warn("[Penjualan] getCompanyInfo failed:", e);
    }
    return {};
}

const { PenjualanPage, initPenjualanPage } = PenjualanModule({
    listPenjualan, getPenjualan, createPenjualan, updatePenjualan,
    deletePenjualan, updatePenjualanStatus,
    voidPenjualan,
    listReturPenjualan, getReturPenjualan, createReturPenjualan,
    updateReturPenjualan, deleteReturPenjualan, updateReturPenjualanStatus,
    listCustomer, listBarang, listWarehouse,
    listSales,
    formatRupiah,
    getCompanyInfo,
    getPosSettings, setPosSettings,
    isPos: true // M3-FIX v21 — mode POS: aksi hanya Nota/Void/Hapus, "No. Nota", tanpa Buat SO Baru
});

export { PenjualanPage, initPenjualanPage };
