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
 * @property {string|null} sidebarLogo Sidebar-specific logo
 * @property {string|null} topbarLogo Topbar-specific logo
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
    language: "id",
    sidebarLogo: null,
    topbarLogo: null
};

/**
 * BrandingManager — centralized branding provider.
 * Reads from company data and provides UI-ready branding.
 */
class BrandingManager {
    constructor() {
        this._listeners = [];
        this._overrides = {};
        this._fromCompany = {};
    }

    /**
     * Load branding from a company data object.
     * Called by CompanyManager.setCompany().
     *
     * @param {object} companyData
     */
    loadFromCompany(companyData) {
        if (!companyData) return;
        this._fromCompany = {
            logo: companyData.logo || null,
            favicon: companyData.favicon || null,
            companyName: companyData.name || companyData.companyName || null,
            workspace: companyData.workspace || "default",
            theme: companyData.theme || "light",
            timezone: companyData.timezone || "Asia/Jakarta",
            currency: companyData.currency || "IDR",
            language: companyData.language || "id",
            sidebarLogo: companyData.sidebarLogo || companyData.logo || null,
            topbarLogo: companyData.topbarLogo || companyData.logo || null
        };
        this._notify();
    }

    /**
     * Get current branding config.
     * Merges company data with defaults and overrides.
     * @returns {BrandingConfig}
     */
    getBranding() {
        return {
            ...DEFAULT_BRANDING,
            ...this._fromCompany,
            ...this._overrides,
            // companyName priority: override > company > default
            companyName: this._overrides.companyName || this._fromCompany.companyName || DEFAULT_BRANDING.companyName,
            // appName only from override or default
            appName: this._overrides.appName || DEFAULT_BRANDING.appName
        };
    }

    /**
     * Get the company logo URL.
     * @returns {string|null}
     */
    getLogo() {
        return this.getBranding().logo;
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
     * Clear branding data (on logout).
     */
    clear() {
        this._fromCompany = {};
        this._overrides = {};
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
        const b = this.getBranding();
        this._listeners.forEach(fn => {
            try { fn(b); } catch (e) {
                console.warn("[BrandingManager] Subscriber error:", e);
            }
        });
    }
}

// ── Singleton instance ──
export const branding = new BrandingManager();
export default branding;
