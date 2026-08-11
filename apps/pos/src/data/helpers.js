/**
 * Shared Data Helpers — eliminates code duplication across data services.
 *
 * @module inventory/data/helpers
 */

import { apiCall } from "./api.js";

/**
 * Get current company code from SMART.Session.
 * @returns {string|null}
 */
export function currentCompanyCode() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SMART) {
            return globalThis.SMART.Session.get("company.code") || globalThis.SMART.Company.getCode();
        }
    } catch {}
    return null;
}

/**
 * Filter items by current company code.
 * @param {object[]} items
 * @returns {object[]}
 */
export function filterData(items) {
    const code = currentCompanyCode();
    if (!code) return items;
    return items.filter(item => item.companyCode === code);
}

/**
 * Tag data with current company code.
 * @param {object} data
 * @returns {object}
 */
export function tagData(data) {
    const code = currentCompanyCode();
    if (!code) return { ...data };
    return { ...data, companyCode: code };
}

/**
 * Simulate network delay for local fallback.
 * @param {number} [ms=200]
 * @returns {Promise<void>}
 */
export function delay(ms = 200) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a kode already exists in the given items array (case-insensitive).
 * API-first: calls GET /api/{endpoint}/check-kode/:kode, falls back to local items.
 *
 * @param {string} endpoint — API endpoint path (e.g. "kategori", "satuan")
 * @param {object[]} items — Local in-memory items array for fallback
 * @param {string} kode — Kode to check
 * @returns {Promise<{exists: boolean, nama?: string, id?: string}>}
 */
export async function checkKodeExists(endpoint, items, kode) {
    try {
        const result = await apiCall("GET", `/${endpoint}/check-kode/${encodeURIComponent(kode)}`);
        if (result !== null) return result;
    } catch (err) {
        console.warn(`[checkKodeExists/${endpoint}] API call failed:`, err?.message);
    }
    const companyCode = currentCompanyCode();
    const local = items.find(i => i.kode?.toLowerCase() === kode.toLowerCase() && (!companyCode || !i.companyCode || i.companyCode === companyCode));
    return local ? { exists: true, nama: local.nama, id: local.id } : { exists: false };
}

/**
 * Find an item with duplicate kode in the items array (case-insensitive).
 * Used in create/update local functions for duplicate validation.
 *
 * @param {object[]} items — Local items array
 * @param {string} kode — Kode to check (already normalized)
 * @param {string|null} [excludeId=null] — If set, exclude item with this ID (for updates)
 * @returns {object|null} — The duplicate item, or null if not found
 */
export function findDuplicateKode(items, kode, excludeId = null) {
    const companyCode = currentCompanyCode();
    return items.find(i => {
        if (excludeId !== null && String(i.id) === String(excludeId)) return false;
        return i.kode?.toLowerCase() === kode.toLowerCase() && (!companyCode || i.companyCode === companyCode);
    });
}
