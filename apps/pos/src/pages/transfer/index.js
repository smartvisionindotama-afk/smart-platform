/**
 * Transfer Page — Thin wrapper around TransferModule.
 *
 * @module inventory/pages/transfer
 */

import { InventoryTransfer as TransferModule } from "@smart/inventory-ui";
import {
    listTransfer, getTransfer, createTransfer, updateTransfer,
    deleteTransfer, updateTransferStatus,
    listWarehouse, listBarang, getCompanyByCode
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
        console.warn("[Transfer] getCompanyInfo failed:", e);
    }
    return {};
}

const { TransferPage, initTransferPage } = TransferModule({
    listTransfer, getTransfer, createTransfer, updateTransfer,
    deleteTransfer, updateTransferStatus,
    listWarehouse, listBarang,
    getCompanyInfo
});

export { TransferPage, initTransferPage };
