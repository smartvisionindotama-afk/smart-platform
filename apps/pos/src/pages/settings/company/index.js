/**
 * Settings — Company Page.
 *
 * Uses SMART Framework SettingsCompanyModule from @smart/ui.
 * Aplikasi hanya inject data services.
 *
 * identityLocked = true: identitas company (Kode + Nama) diatur Master
 * Platform (Console) — admin POS TIDAK bisa mengubahnya; form hanya
 * mengelola konfigurasi (WhatsApp, logo, kontak, dll) & tanpa tombol
 * "Tambah Perusahaan" (company dibuat di Console).
 *
 * @module pos/pages/settings/company
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
    companyTypes: COMPANY_TYPES,
    identityLocked: true
});

export const CompanyPage = module.render;
export const initCompanyPage = module.init;
