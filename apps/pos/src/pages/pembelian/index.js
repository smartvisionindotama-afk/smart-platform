/**
 * Pembelian Page — Thin wrapper around PembelianModule.
 *
 * @module inventory/pages/pembelian
 */

import { InventoryPembelian as PembelianModule } from "@smart/inventory-ui";
import {
    listPembelian, getPembelian, createPembelian, updatePembelian,
    deletePembelian, updatePembelianStatus,
    listReturPembelian, getReturPembelian, createReturPembelian,
    updateReturPembelian, deleteReturPembelian, updateReturPembelianStatus,
    listSupplier, listBarang, listWarehouse,
    getCompanyByCode,
    formatRupiah
} from "../../data/index.js";

/**
 * Fetch company info with full details for invoice printing.
 * Gets current company code from SMART.Session or SMART.Company,
 * then fetches complete company data (address, phone, email, logo).
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
        console.warn("[Pembelian] getCompanyInfo failed:", e);
    }
    return {};
}

const { PembelianPage, initPembelianPage } = PembelianModule({
    listPembelian, getPembelian, createPembelian, updatePembelian,
    deletePembelian, updatePembelianStatus,
    listReturPembelian, getReturPembelian, createReturPembelian,
    updateReturPembelian, deleteReturPembelian, updateReturPembelianStatus,
    listSupplier, listBarang, listWarehouse,
    formatRupiah,
    getCompanyInfo
});

export { PembelianPage, initPembelianPage };
