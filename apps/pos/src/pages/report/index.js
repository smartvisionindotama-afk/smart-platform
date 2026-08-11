/**
 * Report Page — Thin wrapper around LaporanModule.
 *
 * @module inventory/pages/report
 */

import { InventoryReports as LaporanModule } from "@smart/inventory-ui";
import {
    getLaporanStock, getLaporanPurchase, getLaporanSales,
    getInventoryValueReport, getStockMutationReport,
    getSupplierReport, getCustomerReport,
    getLaporanLabarugi, getLaporanPiutang,
    getCompanyByCode
} from "../../data/index.js";

/**
 * Fetch company info for print layout.
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
                    logo: company.logo || ""
                };
            }
        }
    } catch (e) {
        console.warn("[Report] getCompanyInfo failed:", e);
    }
    return {};
}

const { LaporanPage, initLaporanPage } = LaporanModule({
    getLaporanStock, getLaporanPurchase, getLaporanSales,
    getInventoryValueReport, getStockMutationReport,
    getSupplierReport, getCustomerReport,
    getLaporanLabarugi, getLaporanPiutang,
    getCompanyInfo
});

export { LaporanPage, initLaporanPage };
