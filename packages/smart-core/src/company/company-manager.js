/**
 * Company Manager — Enhanced company context management.
 *
 * Bertugas:
 *   - setCompany() — Set current company context
 *   - getCompany() — Get current company data
 *   - clear() — Clear company context
 *   - switchCompany() — Switch to a different company
 *   - loadBranding() — Load branding into BrandingManager
 *   - loadWorkspace() — Load workspace configuration
 *
 * Inventory TIDAK BOLEH lagi mengakses storage secara langsung.
 * Semua akses melalui Company Manager.
 *
 * @module @smart/core/company/company-manager
 */

import { companySession } from "./company-session.js";
import { branding } from "./branding.js";
import { _updateLegacyFallback, _clearLegacyFallback } from "./company-context.js";
import { COMPANY_TYPES, getCompanyTypeOptions } from "./company-types.js";
import {
    validateCompanyCode,
    validateCompanyName,
    validateCompanyData
} from "./company-validator.js";

/** @type {Function[]} */
let _listeners = [];

/**
 * CompanyManager — orchestrates company context, session, and branding.
 */
class CompanyManager {
    /**
     * Set current company context and session.
     *
     * @param {string} companyCode
     * @param {string} [companyName]
     * @param {object} [data] Full company data object
     * @returns {object} Current session
     */
    setCompany(companyCode, companyName, data = null) {
        // Update legacy context directly (NOT via setCompanyContext wrapper,
        // which would cause circular delegation back to this method)
        _updateLegacyFallback(companyCode, companyName);

        // Update session
        companySession.update({
            companyCode,
            companyName: companyName || companyCode,
            companyType: data?.jenis || null,
            companyId: data?.id || null,
            logo: data?.logo || null,
            theme: data?.theme || "light",
            workspace: data?.workspace || "default"
        });

        // Load branding if data provided
        if (data) {
            branding.loadFromCompany(data);
        }

        this._notify();

        return companySession.get();
    }

    /**
     * Get current company info.
     * @returns {{ code: string|null, name: string|null, data: object|null }}
     */
    getCompany() {
        const session = companySession.get();
        return {
            code: session.companyCode,
            name: session.companyName,
            data: session.companyId ? { ...session } : null
        };
    }

    /**
     * Clear company context and session.
     */
    clear() {
        _clearLegacyFallback();
        companySession.destroy();
        branding.clear();
        this._notify();
    }

    /**
     * Switch to a different company.
     * Calls setCompany with new data.
     *
     * @param {string} companyCode
     * @param {string} [companyName]
     * @param {object} [data]
     * @returns {object} New session
     */
    switchTo(companyCode, companyName, data = null) {
        return this.setCompany(companyCode, companyName, data);
    }

    /**
     * @deprecated Use switchTo() instead.
     */
    switchCompany(companyCode, companyName, data = null) {
        return this.setCompany(companyCode, companyName, data);
    }

    /**
     * Load branding from company data into BrandingManager.
     * @param {object} companyData
     */
    loadBranding(companyData) {
        branding.loadFromCompany(companyData);
    }

    /**
     * Load workspace configuration.
     * Can be extended to load workspace-specific settings.
     *
     * @param {string} [workspace] Workspace name
     * @returns {string} Active workspace
     */
    loadWorkspace(workspace) {
        const current = workspace || companySession.getField("workspace") || "default";
        companySession.update({ workspace: current });
        branding.setOverrides({ workspace: current });
        return current;
    }

    /**
     * Get current company code (convenience).
     * @returns {string|null}
     */
    getCode() {
        return companySession.getField("companyCode");
    }

    /**
     * Get current company name (convenience).
     * @returns {string|null}
     */
    getName() {
        return companySession.getField("companyName");
    }

    /**
     * Get company branding config.
     * @returns {object}
     */
    branding() {
        return branding.getBranding();
    }

    /**
     * Get current workspace.
     * @returns {string}
     */
    workspace() {
        return companySession.getField("workspace") || "default";
    }

    /**
     * Validate company data.
     * @param {object} data
     * @returns {{ valid: boolean, errors: object }}
     */
    validate(data) {
        return validateCompanyData(data, { allowedTypes: COMPANY_TYPES });
    }

    /**
     * Get available company types.
     * @returns {string[]}
     */
    types() {
        return [...COMPANY_TYPES];
    }

    /**
     * Get company logo URL.
     * @returns {string|null}
     */
    logo() {
        return branding.getLogo();
    }

    /**
     * Get current theme.
     * @returns {string}
     */
    theme() {
        return companySession.getField("theme") || "light";
    }

    /**
     * Tag data object with current company code.
     * @param {object} data
     * @returns {object}
     */
    tag(data) {
        const code = this.getCode();
        if (!code) return { ...data };
        return { ...data, companyCode: code };
    }

    /**
     * Filter items by current company.
     * @param {object[]} items
     * @returns {object[]}
     */
    filter(items) {
        const code = this.getCode();
        if (!code) return items;
        return items.filter(item => item.companyCode === code);
    }

    /**
     * Subscribe to company changes.
     * @param {function} callback
     * @returns {function} Unsubscribe
     */
    onChange(callback) {
        _listeners.push(callback);
        return () => {
            const idx = _listeners.indexOf(callback);
            if (idx !== -1) _listeners.splice(idx, 1);
        };
    }

    /** @private */
    _notify() {
        const snapshot = this.getCompany();
        _listeners.forEach(fn => {
            try { fn(snapshot); } catch (e) {
                console.warn("[CompanyManager] Subscriber error:", e);
            }
        });
    }
}

// ── Singleton ──
export const companyManager = new CompanyManager();
export default companyManager;
