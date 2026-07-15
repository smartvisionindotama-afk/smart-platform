/**
 * Branding Context — Company branding provider.
 *
 * Provides unified branding information (logo, company name, workspace, theme)
 * for the SMART Platform. Consumed by Sidebar, Topbar, and AppShell.
 *
 * Framework menyediakan BrandingContext.
 * Branding terdiri dari:
 *   - logo
 *   - favicon
 *   - companyName
 *   - appName
 *   - workspace
 *   - theme
 *
 * Sidebar mengambil branding dari Framework.
 * Topbar mengambil branding dari Framework.
 * Inventory tidak boleh mengatur branding sendiri.
 *
 * @module @smart/core/company/branding
 */

import { companyManager } from "./company-context.js";

/**
 * @typedef {object} BrandingConfig
 * @property {string|null} logo Company logo URL or data-URI
 * @property {string|null} favicon Favicon URL
 * @property {string} companyName Company display name
 * @property {string} appName Application name
 * @property {string} workspace Active workspace name
 * @property {string} theme Active theme ("light" | "dark")
 * @property {string} timezone Company timezone
 * @property {string} currency Default currency
 * @property {string} language Default language
 */

/**
 * Default branding values.
 * @type {BrandingConfig}
 */
const DEFAULT_BRANDING = {
    logo: null,
    favicon: null,
    companyName: "SMART Platform",
    appName: "SMART",
    workspace: "default",
    theme: "light",
    timezone: "Asia/Jakarta",
    currency: "IDR",
    language: "id"
};

/**
 * BrandingManager — centralized branding provider.
 * Reads from company context and provides UI-ready branding.
 */
class BrandingManager {
    constructor() {
        this._listeners = [];
        this._overrides = {};
    }

    /**
     * Get current branding config.
     * Merges company data with defaults and overrides.
     * @returns {BrandingConfig}
     */
    getBranding() {
        const companyData = companyManager.getData() || {};
        return {
            ...DEFAULT_BRANDING,
            logo: companyData.logo || this._overrides.logo || null,
            favicon: companyData.favicon || this._overrides.favicon || null,
            companyName: companyManager.getName() || companyData.name || DEFAULT_BRANDING.companyName,
            appName: this._overrides.appName || DEFAULT_BRANDING.appName,
            workspace: companyData.workspace || DEFAULT_BRANDING.workspace,
            theme: this._overrides.theme || DEFAULT_BRANDING.theme,
            timezone: companyData.timezone || DEFAULT_BRANDING.timezone,
            currency: companyData.currency || DEFAULT_BRANDING.currency,
            language: companyData.language || DEFAULT_BRANDING.language
        };
    }

    /**
     * Get the company logo URL.
     * @returns {string|null}
     */
    getLogo() {
        const branding = this.getBranding();
        return branding.logo;
    }

    /**
     * Get company name for display.
     * @returns {string}
     */
    getCompanyName() {
        return this.getBranding().companyName;
    }

    /**
     * Set override values (e.g., app-specific branding).
     * @param {Partial<BrandingConfig>} overrides
     */
    setOverrides(overrides = {}) {
        this._overrides = { ...this._overrides, ...overrides };
        this._notify();
    }

    /**
     * Subscribe to branding changes.
     * @param {function} callback
     * @returns {function} Unsubscribe
     */
    onChange(callback) {
        this._listeners.push(callback);
        return () => {
            const idx = this._listeners.indexOf(callback);
            if (idx !== -1) this._listeners.splice(idx, 1);
        };
    }

    /**
     * Apply favicon to document.
     */
    applyFavicon() {
        const branding = this.getBranding();
        if (!branding.favicon) return;
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
        }
        link.href = branding.favicon;
    }

    /** @private */
    _notify() {
        const branding = this.getBranding();
        this._listeners.forEach(fn => {
            try { fn(branding); } catch (e) {
                console.warn("[BrandingManager] Subscriber error:", e);
            }
        });
    }
}

// ── Singleton instance ──
export const branding = new BrandingManager();
export default branding;
