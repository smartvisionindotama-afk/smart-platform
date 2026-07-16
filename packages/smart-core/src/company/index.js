/**
 * Company SDK — Internal module aggregator.
 *
 * NOTE: This file is an INTERNAL implementation detail.
 * Programmer aplikasi TIDAK BOLEH meng-import dari sini.
 *
 * ✅ BENAR:
 *   import { SMART } from "@smart/core";          // Public Facade
 *   SMART.Company.get()                            // Company SDK
 *
 * ⚠️ @deprecated (masih berfungsi):
 *   import { branding } from "@smart/core/company";
 *
 * @module @smart/core/company
 * @internal
 */

// ── Company Manager (Facade orchestrator) ──
export { companyManager } from "./company-manager.js";

// ── Company Session ──
export { companySession } from "./company-session.js";

// ── Company Storage ──
export { companyStorage } from "./company-storage.js";

// ── Company Validator ──
export {
    validateCompanyCode,
    validateCompanyName,
    validateEmail,
    validatePhone,
    validateCompanyType,
    validateCompanyData
} from "./company-validator.js";

// ── Branding ──
export { branding } from "./branding.js";

// ── Company Types ──
export { COMPANY_TYPES, getCompanyTypeOptions } from "./company-types.js";

// ═══════════════════════════════════════════════
//  LEGACY COMPATIBILITY LAYER
// ═══════════════════════════════════════════════
//
// Export berikut hanya untuk backward compatibility.
// Aplikasi baru HARUS menggunakan SMART.Company / SMART.Session.
//
// ═══════════════════════════════════════════════

/** @deprecated Gunakan SMART.Company.set() atau SMART.Session */
export {
    setCompanyContext,
    getCompanyCode,
    getCompanyName,
    clearCompanyContext,
    hasCompanyContext,
    tagWithCompany,
    filterByCompany
} from "./company-context.js";
