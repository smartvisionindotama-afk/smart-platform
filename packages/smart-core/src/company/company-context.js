/**
 * ═══════════════════════════════════════════════════════════════
 *  LEGACY COMPATIBILITY LAYER
 * ═══════════════════════════════════════════════════════════════
 *
 * File ini dipertahankan agar aplikasi lama tetap berjalan.
 *
 * Semua function di sini adalah WRAPPER yang meneruskan
 * request ke SDK baru (SMART.Company / SMART.Session).
 *
 * Development baru wajib menggunakan:
 *
 *   SMART.Company   — Company.get(), Company.set(), Company.switch()
 *   SMART.Session   — Session.get("company.code"), Session.company()
 *
 * Jangan menambah logic baru pada file ini.
 *
 * @module @smart/core/company/company-context
 * @deprecated Gunakan SMART.Company atau SMART.Session
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Get the SMART namespace, handling both module and global access.
 * @returns {object|null}
 */
function _getSMART() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SMART) {
            return globalThis.SMART;
        }
    } catch {}
    // Fallback — dynamic import would be needed, but this is a legacy layer
    return null;
}

/**
 * Set the current company context.
 *
 * @deprecated Gunakan `SMART.Company.set()` atau `SMART.Session`.
 *
 * @param {string} companyCode
 * @param {string} [companyName]
 */
export function setCompanyContext(companyCode, companyName) {
    const smart = _getSMART();
    if (smart && smart.Company && smart.Company.set) {
        smart.Company.set(companyCode, companyName);
        return;
    }
    // Last-resort fallback: use old module-level variables
    _legacySetContext(companyCode, companyName);
}

/**
 * Get the current company code.
 *
 * @deprecated Gunakan `SMART.Session.get("company.code")` atau `SMART.Company.getCode()`.
 *
 * @returns {string|null}
 */
export function getCompanyCode() {
    const smart = _getSMART();
    if (smart && smart.Session && smart.Session.get) {
        return smart.Session.get("company.code");
    }
    if (smart && smart.Company && smart.Company.getCode) {
        return smart.Company.getCode();
    }
    return _legacyGetCode();
}

/**
 * Get the current company name.
 *
 * @deprecated Gunakan `SMART.Session.get("company.name")` atau `SMART.Company.getName()`.
 *
 * @returns {string|null}
 */
export function getCompanyName() {
    const smart = _getSMART();
    if (smart && smart.Session && smart.Session.get) {
        return smart.Session.get("company.name");
    }
    if (smart && smart.Company && smart.Company.getName) {
        return smart.Company.getName();
    }
    return _legacyGetName();
}

/**
 * Clear company context (e.g. on logout).
 *
 * @deprecated Gunakan `SMART.Company.clear()` atau `SMART.Session.destroy()`.
 */
export function clearCompanyContext() {
    const smart = _getSMART();
    if (smart && smart.Company && smart.Company.clear) {
        smart.Company.clear();
        return;
    }
    _legacyClear();
}

/**
 * Check if a company context is active.
 *
 * @deprecated Gunakan `SMART.Session.isAuthenticated()`.
 *
 * @returns {boolean}
 */
export function hasCompanyContext() {
    const smart = _getSMART();
    if (smart && smart.Session && smart.Session.get) {
        return !!smart.Session.get("company.code");
    }
    if (smart && smart.Company && smart.Company.getCode) {
        return !!smart.Company.getCode();
    }
    return _legacyHasContext();
}

/**
 * Tag data with the current company code.
 *
 * @deprecated Gunakan `BaseRepository._tagWithCompany()` atau `SMART.Company.tag()`.
 *
 * @param {object} data
 * @returns {object}
 */
export function tagWithCompany(data) {
    const smart = _getSMART();
    if (smart && smart.Company && smart.Company.tag) {
        return smart.Company.tag(data);
    }
    const code = getCompanyCode();
    if (!code) return { ...data };
    return { ...data, companyCode: code };
}

/**
 * Filter an array of items to only include those
 * belonging to the current company.
 *
 * @deprecated Gunakan `BaseRepository._filterByCompany()` atau `SMART.Company.filter()`.
 *
 * @param {object[]} items
 * @returns {object[]}
 */
export function filterByCompany(items) {
    const smart = _getSMART();
    if (smart && smart.Company && smart.Company.filter) {
        return smart.Company.filter(items);
    }
    const code = getCompanyCode();
    if (!code) return items;
    return items.filter(item => item.companyCode === code);
}

// ═══════════════════════════════════════════════
//  ULTIMATE FALLBACK — hanya jika SMART belum siap
// ═══════════════════════════════════════════════

/** @type {string|null} */
let _fallbackCompanyCode = null;
/** @type {string|null} */
let _fallbackCompanyName = null;

function _legacySetContext(code, name) {
    _fallbackCompanyCode = code;
    _fallbackCompanyName = name || code;
}

function _legacyGetCode() {
    return _fallbackCompanyCode;
}

function _legacyGetName() {
    return _fallbackCompanyName;
}

function _legacyClear() {
    _fallbackCompanyCode = null;
    _fallbackCompanyName = null;
}

function _legacyHasContext() {
    return _fallbackCompanyCode !== null;
}
