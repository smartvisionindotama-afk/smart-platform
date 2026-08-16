/**
 * @smart/core — SMART Core Framework.
 *
 * ████████████████████████████████████████████████████████████
 * PUBLIC SDK — FACADE ARCHITECTURE
 * ████████████████████████████████████████████████████████████
 *
 * Programmer aplikasi hanya mengenal SMART.*
 * Seluruh implementasi internal tersembunyi di balik Facade.
 *
 * ✅ BENAR:
 *   import { SMART } from "@smart/core";
 *   SMART.Session.company()
 *   SMART.Company.get()
 *   SMART.Permission.can()
 *
 * ⚠️ @deprecated (masih berfungsi, tapi akan dihapus):
 *   import { Auth, Permission, branding } from "@smart/core";
 *
 * @module @smart/core
 */

// ═══════════════════════════════════════════════════════════════
//  PRIMARY API: SMART Facade
// ═══════════════════════════════════════════════════════════════

export { SMART, default } from "./facade.js";

// ═══════════════════════════════════════════════════════════════
//  Public Utils (Framework First)
//  Util global yang dipakai lintas aplikasi — WAJIB dari framework,
//  bukan di-copy ke masing-masing aplikasi.
// ═══════════════════════════════════════════════════════════════

export { formatRupiah, formatRupiahID, formatNumber, formatDecimal, formatThousand, unformatThousand, parseIdNumber } from "./utils/format.js";
export { esc, escHtml, escAttr } from "./utils/escape.js";
export { formatDate, formatDateID, formatDateTime, timeAgo } from "./utils/date.js";

// ═══════════════════════════════════════════════════════════════
//  Transaction Capability Registry (SP-029 — POS V1)
//  Satu-satunya sumber kebenaran capability jenis transaksi POS.
//  Dipakai Console (admin), POS server (validasi/gate) & POS client
//  (filter menu/route).
// ═══════════════════════════════════════════════════════════════

export * from "./transaction-types/transaction-types.js";

// ═══════════════════════════════════════════════════════════════
//  @deprecated — Backward Compatible Exports
//  Aplikasi baru HARUS menggunakan SMART.*
// ═══════════════════════════════════════════════════════════════

/** @deprecated Gunakan SMART.Permission.can() */
export { default as Auth } from "./auth/auth.js";

/** @deprecated Gunakan SMART.Permission */
export { default as Institution } from "./institution/institution.js";

/** @deprecated Gunakan SMART.Permission */
export { default as Permission } from "./permission/permission.js";

/** @deprecated Gunakan SMART.Platform */
export { default as AppConfig } from "./app/app.js";

/** @deprecated Gunakan SMART.Permission */
export * from "./permission/engine.js";

/** @deprecated Gunakan SMART.Permission */
export * from "./permission/roles.js";

/** @deprecated Gunakan SMART.Company */
export { companyManager } from "./company/company-manager.js";

/** @deprecated Gunakan SMART.Session */
export { companySession } from "./company/company-session.js";

/** @deprecated Internal */
export { companyStorage } from "./company/company-storage.js";

/** @deprecated Gunakan SMART.Company.validate() */
export {
    validateCompanyCode,
    validateCompanyName,
    validateEmail,
    validatePhone,
    validateCompanyType,
    validateCompanyData
} from "./company/company-validator.js";

/** @deprecated Gunakan SMART.Company.set() / SMART.Session */
export {
    setCompanyContext,
    getCompanyCode,
    getCompanyName,
    clearCompanyContext,
    hasCompanyContext,
    tagWithCompany,
    filterByCompany
} from "./company/company-context.js";

/** @deprecated Gunakan SMART.Company.branding() */
export { branding } from "./company/branding.js";

/** @deprecated Gunakan SMART.Company.types() */
export { COMPANY_TYPES, getCompanyTypeOptions } from "./company/company-types.js";

/** @deprecated Gunakan SMART.Session */
export { framework } from "./context/index.js";

/** @deprecated Gunakan SMART.Impersonation */
export { impersonation } from "./impersonation/index.js";

/** @deprecated Gunakan SMART.Audit */
export { audit } from "./audit/index.js";

/** @deprecated Gunakan SMART.Platform */
export { platform } from "./platform/index.js";

/** @deprecated Gunakan SMART.Session */
export { session } from "./session/index.js";
