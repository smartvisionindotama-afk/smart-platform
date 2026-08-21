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
    getLaporanLabarugi, getLaporanPiutang
} from "../../data/index.js";
import { apiCall } from "../../data/api.js";

/**
 * Fetch company info for print layout.
 * Uses /api/company-profile (POS server) for full data (name, address,
 * phone, email, logo) — NOT getCompanyByCode() which returns lightweight
 * payload from Console (code/name/logo only).
 */
async function getCompanyInfo() {
    try {
        const result = await apiCall("GET", "/company-profile");
        if (result?.data) {
            const c = result.data;
            return {
                name: c.name || "",
                address: c.address || "",
                phone: c.phone || "",
                email: c.email || "",
                logo: c.logo || ""
            };
        }
    } catch (e) {
        console.warn("[Report] getCompanyInfo failed:", e);
    }
    return {};
}

const { LaporanPage, initLaporanPage, setActiveTab } = LaporanModule({
    getLaporanStock, getLaporanPurchase, getLaporanSales,
    getInventoryValueReport, getStockMutationReport,
    getSupplierReport, getCustomerReport,
    getLaporanLabarugi, getLaporanPiutang,
    getCompanyInfo,
    isPos: true // M6-FIX — mode POS: label "No. Nota" / "Total Nota" (bukan SO)
});

export { LaporanPage, initLaporanPage, setActiveTab };
