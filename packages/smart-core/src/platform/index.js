/**
 * Platform Manager — Applications, Companies, Workspaces, Subscriptions.
 *
 * Platform Manager menjadi pusat seluruh aplikasi.
 * Harus mengetahui: Application, Workspace, Subscription, License,
 * SuperAdmin, Company, Login As Company, Current Application, Current Company.
 *
 * @module @smart/core/platform
 */

/**
 * @typedef {object} Application
 * @property {string} id Application ID
 * @property {string} slug Application slug (e.g. "inventory")
 * @property {string} name Display name
 * @property {string} description Short description
 * @property {string} icon Emoji or icon string
 * @property {string} workspace Default workspace name
 * @property {boolean} active Whether the app is active
 * @property {string} [version] Application version
 */

/**
 * @typedef {object} CompanyApp
 * @property {string} companyId Company ID
 * @property {string} application Application slug
 * @property {boolean} enabled Whether the app is enabled for this company
 * @property {number} subscribedAt When the subscription started
 * @property {string} [tier] Subscription tier
 * @property {boolean} [licensed] Whether licensed
 */

/** @type {Application[]} Built-in applications */
const BUILTIN_APPS = [
    { id: "1", slug: "inventory", name: "Inventory", description: "Manajemen inventori gudang dan stok barang", icon: "📦", workspace: "warehouse", active: true, version: "1.0.0" },
    { id: "2", slug: "accounting", name: "Accounting", description: "Akuntansi dan pembukuan keuangan", icon: "💰", workspace: "corporate", active: false, version: "1.0.0" },
    { id: "3", slug: "pos", name: "POS", description: "Point of Sale untuk kasir dan transaksi", icon: "🛒", workspace: "default", active: false, version: "1.0.0" },
    { id: "4", slug: "wms", name: "WMS", description: "Warehouse Management System lanjutan", icon: "🏭", workspace: "warehouse", active: false, version: "1.0.0" },
    { id: "5", slug: "sitampan", name: "SITAMPAN", description: "Sistem Informasi Tata Kelola Pemerintahan Desa", icon: "🏘️", workspace: "default", active: false, version: "1.0.0" },
    { id: "6", slug: "santri-pintar", name: "Santri Pintar", description: "Manajemen pondok pesantren", icon: "📚", workspace: "default", active: false, version: "1.0.0" },
    { id: "7", slug: "e-profit", name: "e-Profit", description: "BMT/Koperasi Simpan Pinjam", icon: "🏦", workspace: "corporate", active: false, version: "1.0.0" },
    { id: "8", slug: "desa-insight", name: "Desa Insight", description: "Analisis data pembangunan desa", icon: "📊", workspace: "default", active: false, version: "1.0.0" }
];

/** @type {Application[]} */
let _applications = [...BUILTIN_APPS];

/** @type {CompanyApp[]} */
let _companyApps = [];

/**
 * PlatformManager — manages apps and company-app mappings.
 */
class PlatformManager {
    constructor() {
        this._listeners = [];
    }

    // ── Applications ──

    /**
     * Get all registered applications.
     * @param {object} [filters]
     * @param {boolean} [filters.onlyActive=true] Only return active apps
     * @returns {Application[]}
     */
    getApps(filters = {}) {
        const { onlyActive = true } = filters;
        let result = [..._applications];
        if (onlyActive) result = result.filter(a => a.active);
        return result;
    }

    /**
     * Get an application by slug.
     * @param {string} slug
     * @returns {Application|null}
     */
    getApp(slug) {
        return _applications.find(a => a.slug === slug) || null;
    }

    // ── Company-App Mapping ──

    /**
     * Enable an application for a company.
     * @param {string} companyId
     * @param {string} appSlug
     */
    enableAppForCompany(companyId, appSlug) {
        const existing = _companyApps.find(ca => ca.companyId === companyId && ca.application === appSlug);
        if (existing) {
            existing.enabled = true;
        } else {
            _companyApps.push({ companyId, application: appSlug, enabled: true, subscribedAt: Date.now() });
        }
        this._notify();
    }

    /**
     * Disable an application for a company.
     * @param {string} companyId
     * @param {string} appSlug
     */
    disableAppForCompany(companyId, appSlug) {
        const existing = _companyApps.find(ca => ca.companyId === companyId && ca.application === appSlug);
        if (existing) existing.enabled = false;
        this._notify();
    }

    /**
     * Get enabled applications for a company.
     * @param {string} companyId
     * @returns {Application[]}
     */
    getCompanyApps(companyId) {
        const enabledSlugs = _companyApps
            .filter(ca => ca.companyId === companyId && ca.enabled)
            .map(ca => ca.application);
        return _applications.filter(a => enabledSlugs.includes(a.slug) && a.active);
    }

    /**
     * Check if a company has access to an application.
     * @param {string} companyId
     * @param {string} appSlug
     * @returns {boolean}
     */
    hasAccess(companyId, appSlug) {
        const app = _applications.find(a => a.slug === appSlug);
        if (!app || !app.active) return false;
        const mapping = _companyApps.find(ca => ca.companyId === companyId && ca.application === appSlug);
        return mapping ? mapping.enabled : false;
    }

    /**
     * Get workspace for a company and application.
     * @param {string} companyId
     * @param {string} appSlug
     * @returns {string}
     */
    getWorkspace(companyId, appSlug) {
        const app = _applications.find(a => a.slug === appSlug);
        if (!app) return "default";
        return app.workspace || "default";
    }

    /**
     * Get current application info from session.
     * @returns {Application|null}
     */
    getCurrentApplication() {
        try {
            if (typeof globalThis !== 'undefined' && globalThis.SMART && globalThis.SMART.Session) {
                const appId = globalThis.SMART.Session.get("application.code");
                if (appId) return this.getApp(appId);
            }
        } catch {}
        return null;
    }

    /**
     * Get current company info from session.
     * @returns {{ id: string|null, code: string|null, name: string|null }|null}
     */
    getCurrentCompany() {
        try {
            if (typeof globalThis !== 'undefined' && globalThis.SMART && globalThis.SMART.Session) {
                return {
                    id: globalThis.SMART.Session.get("company.id"),
                    code: globalThis.SMART.Session.get("company.code"),
                    name: globalThis.SMART.Session.get("company.name")
                };
            }
        } catch {}
        return null;
    }

    /**
     * Get all company-app mappings.
     * @returns {CompanyApp[]}
     */
    getAllMappings() {
        return [..._companyApps];
    }

    /**
     * Load platform data (e.g., from API response).
     * @param {object} data
     * @param {Application[]} [data.applications]
     * @param {CompanyApp[]} [data.companyApps]
     */
    loadPlatform(data = {}) {
        if (!data) return;
        if (data.applications) _applications = [...data.applications];
        if (data.companyApps) _companyApps = [...data.companyApps || []];
        this._notify();
    }

    /**
     * Subscribe to platform changes.
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

    /** @private */
    _notify() {
        this._listeners.forEach(fn => {
            try { fn(); } catch (e) {
                console.warn("[PlatformManager] Subscriber error:", e);
            }
        });
    }
}

// ── Singleton ──
export const platform = new PlatformManager();
export default platform;
