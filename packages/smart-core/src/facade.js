/**
 * SMART Facade — Single public entry point for @smart/core.
 *
 * Programmer aplikasi hanya mengenal SMART.*
 * Seluruh implementasi internal tersembunyi.
 *
 * @module @smart/core/facade
 */

import { companyManager as _Company } from "./company/company-manager.js";
import { session as _Session } from "./session/index.js";
import { branding as _Branding } from "./company/branding.js";
import { platform as _Platform } from "./platform/index.js";
import { audit as _Audit } from "./audit/index.js";
import { impersonation as _Impersonation } from "./impersonation/index.js";
import Permission from "./permission/permission.js";
import { COMPANY_TYPES as _Types, getCompanyTypeOptions as _TypesOptions } from "./company/company-types.js";
import { validateCompanyData as _Validate } from "./company/company-validator.js";

/** @type {object|null} Internal DB SDK reference */
let _DB = null;

/** @type {object|null} Internal API SDK reference */
let _API = null;

/**
 * SMART — Unified framework namespace (Facade).
 *
 * Programmer aplikasi cukup menulis:
 *
 *   SMART.Session.company()
 *   SMART.Company.switch()
 *   SMART.DB.collection("barang")
 *   SMART.API.get("/barang")
 *   SMART.Permission.can("inventory.barang.edit")
 *   SMART.Platform.currentCompany()
 *   SMART.Audit.log(...)
 *   SMART.UI.Modal.open(...)
 *
 * tanpa mengetahui implementasi internal.
 */
const SMART = {

    // ═══════════════════════════════════════════
    //  Session Facade
    // ═══════════════════════════════════════════

    Session: {
        /** Create session with data */
        create: (data) => _Session.create(data),

        /** Restore session from storage */
        restore: () => _Session.restore(),

        /** Persist session to storage */
        save: () => _Session.save(),

        /** Destroy session */
        destroy: () => _Session.destroy(),

        /** Refresh from storage */
        refresh: () => _Session.refresh(),

        /** Initialize from flat data (backward compat) */
        init: (data) => _Session.init(data),

        /** Get current session state */
        getState: () => _Session.getState(),

        /** Get a value by dot path */
        get: (path) => _Session.get(path),

        /** Update session fields */
        update: (updates) => _Session.update(updates),

        /** Check if session is ready */
        isReady: () => _Session.isReady(),

        /** Check if authenticated */
        isAuthenticated: () => _Session.isAuthenticated(),

        /** Get user object */
        user: () => _Session.get("user"),

        /** Get company object */
        company: () => _Session.get("company"),

        /** Get application object */
        application: () => _Session.get("application"),

        /** Get workspace name */
        workspace: () => _Session.get("company.workspace") || "default",

        /** Get active theme */
        theme: () => _Session.get("theme") || "light",

        /** Subscribe to changes */
        onChange: (cb) => _Session.onChange(cb)
    },

    // ═══════════════════════════════════════════
    //  Company Facade
    // ═══════════════════════════════════════════

    Company: {
        /** Get current company info */
        get: () => _Company.getCompany(),

        /** Alias for get() */
        current: () => _Company.getCompany(),

        /** Set current company */
        set: (code, name, data) => _Company.setCompany(code, name, data),

        /** Clear company context */
        clear: () => _Company.clear(),

        /** Switch to a different company */
        ['switch']: (code, name, data) => _Company.switchTo(code, name, data),
        switchTo: (code, name, data) => _Company.switchTo(code, name, data),

        /** Get branding config */
        branding: () => _Branding.getBranding(),

        /** Get current workspace */
        workspace: () => _Company.workspace(),

        /** Get company logo */
        logo: () => _Company.logo(),

        /** Get active theme */
        theme: () => _Company.theme(),

        /** Validate company data */
        validate: (data) => _Validate(data, { allowedTypes: _Types }),

        /** Get available company types */
        types: () => _Types,
        typeOptions: () => _TypesOptions(),

        /** Check if company is loaded */
        exists: () => !!_Company.getCode(),

        /** Alias for exists() */
        isLoaded: () => !!_Company.getCode(),

        /** Get current company code */
        getCode: () => _Company.getCode(),

        /** Get current company name */
        getName: () => _Company.getName(),

        /** Subscribe to company changes */
        onChange: (cb) => _Company.onChange(cb)
    },

    // ═══════════════════════════════════════════
    //  Database Facade
    // ═══════════════════════════════════════════

    DB: {
        /** Initialize DB SDK */
        init(dbImpl) { _DB = dbImpl; },

        /** Get collection proxy */
        collection: (name) => _DB?.collection?.(name) || {
            find: () => Promise.resolve({ data: [] }),
            findOne: () => Promise.resolve(null),
            insert: (d) => Promise.resolve(d),
            update: () => Promise.resolve(null),
            delete: () => Promise.resolve(true),
            aggregate: () => Promise.resolve([]),
            batch: () => Promise.resolve([]),
            transaction: () => Promise.resolve([]),
            watch: () => Promise.resolve({})
        },

        /** Shorthand methods */
        find: (c, p) => _DB?.find?.(c, p) || Promise.resolve({ data: [] }),
        findOne: (c, id) => _DB?.findOne?.(c, id) || Promise.resolve(null),
        insert: (c, d) => _DB?.insert?.(c, d) || Promise.resolve(d),
        update: (c, id, d) => _DB?.update?.(c, id, d) || Promise.resolve(d),
        delete: (c, id) => _DB?.delete?.(c, id) || Promise.resolve(true),
        aggregate: (c, p) => _DB?.collection?.(c)?.aggregate?.(p) || Promise.resolve([]),
        batch: (c, d) => _DB?.collection?.(c)?.batch?.(d) || Promise.resolve([]),
        transaction: (ops) => _DB?.collection?.("__sys__")?.transaction?.(ops) || Promise.resolve([]),
        watch: (c, p) => _DB?.collection?.(c)?.watch?.(p) || Promise.resolve({})
    },

    // ═══════════════════════════════════════════
    //  API Facade
    // ═══════════════════════════════════════════

    API: {
        /** Initialize API SDK */
        init(apiImpl) { _API = apiImpl; },

        get: (url, params, opts) => _API?.get?.(url, params, opts) || Promise.reject(new Error("API SDK not initialized")),
        post: (url, body, opts) => _API?.post?.(url, body, opts) || Promise.reject(new Error("API SDK not initialized")),
        put: (url, body, opts) => _API?.put?.(url, body, opts) || Promise.reject(new Error("API SDK not initialized")),
        patch: (url, body, opts) => _API?.patch?.(url, body, opts) || Promise.reject(new Error("API SDK not initialized")),
        delete: (url, opts) => _API?.delete?.(url, opts) || Promise.reject(new Error("API SDK not initialized")),
        upload: (url, fd, opts) => _API?.upload?.(url, fd, opts) || Promise.reject(new Error("API SDK not initialized")),
        download: (url, opts) => _API?.download?.(url, opts) || Promise.reject(new Error("API SDK not initialized"))
    },

    // ═══════════════════════════════════════════
    //  Permission Facade
    // ═══════════════════════════════════════════

    Permission: {
        can: (perm) => Permission.can(perm),
        cannot: (perm) => !Permission.can(perm),
        canAny: (perms) => Permission.canAny(perms),
        canAll: (perms) => Permission.canAll(perms),
        hasRole: (role) => Permission.currentRole()?.name?.toLowerCase() === role.toLowerCase(),
        hasPermission: (perm) => Permission.can(perm),
        currentRole: () => Permission.currentRole(),
        menu: () => Permission.menu(),
        assign: (role, perm) => Permission.grant(role, perm),
        revoke: (role, perm) => Permission.revoke(role, perm),
        setOverride: (perms) => Permission.setOverride(perms),
        roles: () => Permission.roles(),
        onChange: (cb) => Permission.onChange(cb)
    },

    // ═══════════════════════════════════════════
    //  Platform Facade
    // ═══════════════════════════════════════════

    Platform: {
        getApps: (filters) => _Platform.getApps(filters),
        getApp: (slug) => _Platform.getApp(slug),
        getCompanyApps: (companyId) => _Platform.getCompanyApps(companyId),
        hasAccess: (companyId, appSlug) => _Platform.hasAccess(companyId, appSlug),
        currentApplication: () => _Platform.getApp(
            _Session.get("application.code") || _Session.get("applicationId")
        ),
        currentApp: () => _Platform.getCurrentApplication(),
        currentCompany: () => _Platform.getCurrentCompany(),
        currentWorkspace: (companyId, appSlug) => _Platform.getWorkspace(companyId, appSlug),
        currentUser: () => _Session.get("user"),
        loginAsCompany: (appSlug, companyCode, companyName) => _Impersonation.start({
            superAdminId: _Session.get("user.id"),
            superAdminName: _Session.get("user.name"),
            companyId: companyCode, companyName,
            userId: companyCode + "-admin",
            userName: `Admin ${companyName}`,
            application: appSlug, role: "owner"
        }),
        exitImpersonation: () => _Impersonation.end(),
        subscription: (companyId, appSlug) => ({
            enabled: _Platform.hasAccess(companyId, appSlug)
        }),
        license: () => ({ status: "active", type: "enterprise" }),
        getWorkspace: (companyId, appSlug) => _Platform.getWorkspace(companyId, appSlug),
        enableApp: (companyId, appSlug) => _Platform.enableAppForCompany(companyId, appSlug),
        disableApp: (companyId, appSlug) => _Platform.disableAppForCompany(companyId, appSlug),
        onChange: (cb) => _Platform.onChange(cb)
    },

    // ═══════════════════════════════════════════
    //  Audit Facade
    // ═══════════════════════════════════════════

    Audit: {
        log: (entry) => _Audit.log(entry),
        history: (filters) => _Audit.getEntries(filters),
        export: (filters) => _Audit.getEntries(filters),
        getEntries: (filters) => _Audit.getEntries(filters),
        clear: () => _Audit.clear(),
        setSync: (fn) => _Audit.setSync(fn),
        onChange: (cb) => _Audit.onChange(cb)
    },

    // ═══════════════════════════════════════════
    //  Impersonation Facade
    // ═══════════════════════════════════════════

    Impersonation: {
        loginAs: (session) => _Impersonation.start(session),
        isImpersonating: () => _Impersonation.isImpersonating(),
        end: () => _Impersonation.end(),
        getSession: () => _Impersonation.getSession(),
        getSuperAdmin: () => _Impersonation.getSuperAdmin(),
        onChange: (cb) => _Impersonation.onChange(cb)
    }
};

// ── Attach to globalThis for console access ──
if (typeof globalThis !== "undefined") {
    globalThis.SMART = SMART;
}

export { SMART };
export default SMART;
