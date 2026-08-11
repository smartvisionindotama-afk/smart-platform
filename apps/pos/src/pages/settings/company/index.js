/**
 * Settings — Company Page.
 *
 * Uses SMART Framework SettingsCompanyModule from @smart/ui.
 * Inventory hanya inject data services.
 *
 * @module inventory/pages/settings/company
 */

import { SettingsCompanyModule } from "@smart/ui/modules/settings";
import { COMPANY_TYPES } from "@smart/core";
import {
    listCompanies, getCompany, createCompany, updateCompany, deleteCompany
} from "../../../data/index.js";

const module = SettingsCompanyModule({
    listCompanies,
    getCompany,
    createCompany,
    updateCompany,
    deleteCompany,
    companyTypes: COMPANY_TYPES
});

export const CompanyPage = module.render;
export const initCompanyPage = module.init;
