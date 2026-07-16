/**
 * SMART.Session — Global session singleton with nested object structure.
 *
 * JANGAN menggunakan struktur flat.
 * Gunakan struktur object:
 *
 *   SMART.Session.user.id
 *   SMART.Session.company.code
 *   SMART.Session.company.branding
 *   SMART.Session.application.id
 *
 * @module @smart/core/session
 */

import { companySession } from "../company/company-session.js";
import { branding } from "../company/branding.js";

/** @type {object} Default session state */
const DEFAULT_STATE = {
    user: {
        id: null,
        name: null,
        email: null,
        role: null,
        permissions: []
    },
    company: {
        id: null,
        code: null,
        name: null,
        type: null,
        logo: null,
        branding: {},
        workspace: "default"
    },
    application: {
        id: null,
        code: null,
        name: null,
        version: null
    },
    theme: "light",
    locale: "id",
    authenticated: false
};

/** @type {object} Current session state */
let _state = { ..._deepClone(DEFAULT_STATE) };

/** @type {Function[]} */
let _listeners = [];

/**
 * SmartSession — Global session singleton.
 */
class SmartSession {
    constructor() {
        this._initialized = false;
    }

    /**
     * Create a new session with provided data.
     * @param {object} data - Session data with nested structure
     * @returns {object} Current session state
     */
    create(data = {}) {
        _state = {
            user: { ...DEFAULT_STATE.user, ...(data.user || {}) },
            company: { ...DEFAULT_STATE.company, ...(data.company || {}) },
            application: { ...DEFAULT_STATE.application, ...(data.application || {}) },
            theme: data.theme || DEFAULT_STATE.theme,
            locale: data.locale || DEFAULT_STATE.locale,
            authenticated: data.authenticated !== undefined ? data.authenticated : !!data.user?.id
        };

        // Sync to company session for backward compatibility
        companySession.update({
            userId: _state.user.id,
            companyId: _state.company.id,
            companyCode: _state.company.code,
            companyName: _state.company.name,
            companyType: _state.company.type,
            applicationId: _state.application.id,
            workspace: _state.company.workspace,
            role: _state.user.role,
            permissions: _state.user.permissions,
            logo: _state.company.logo,
            theme: _state.theme
        });

        // Load branding
        if (_state.company.branding) {
            branding.loadFromCompany(_state.company.branding);
        }

        this._initialized = true;
        this.save();
        this._notify();
        return this.getState();
    }

    /**
     * Get current session state (immutable snapshot).
     * @returns {object}
     */
    getState() {
        return _deepClone(_state);
    }

    /**
     * Get a specific field from session using dot notation.
     * @param {string} path - e.g. "user.id", "company.code"
     * @returns {*}
     */
    get(path) {
        const parts = path.split(".");
        let current = _state;
        for (const part of parts) {
            if (current === null || current === undefined) return null;
            current = current[part];
        }
        return current !== undefined ? current : null;
    }

    /**
     * Update specific fields in the session.
     * @param {object} updates - Partial session data
     */
    update(updates = {}) {
        if (updates.user) {
            _state.user = { ..._state.user, ...updates.user };
        }
        if (updates.company) {
            _state.company = { ..._state.company, ...updates.company };
        }
        if (updates.application) {
            _state.application = { ..._state.application, ...updates.application };
        }
        if (updates.theme !== undefined) _state.theme = updates.theme;
        if (updates.locale !== undefined) _state.locale = updates.locale;
        if (updates.authenticated !== undefined) _state.authenticated = updates.authenticated;

        // Sync to company session
        companySession.update({
            userId: _state.user.id,
            companyId: _state.company.id,
            companyCode: _state.company.code,
            companyName: _state.company.name,
            companyType: _state.company.type,
            workspace: _state.company.workspace,
            role: _state.user.role,
            logo: _state.company.logo,
            theme: _state.theme
        });

        this.save();
        this._notify();
    }

    /**
     * Persist session to storage.
     */
    save() {
        companySession.save();
    }

    /**
     * Restore session from storage.
     * @returns {boolean}
     */
    restore() {
        const stored = companySession.load(true);
        if (!stored) return false;

        _state = {
            user: {
                id: stored.userId || null,
                name: null,
                email: null,
                role: stored.role || null,
                permissions: stored.permissions || []
            },
            company: {
                id: stored.companyId || null,
                code: stored.companyCode || null,
                name: stored.companyName || null,
                type: stored.companyType || null,
                logo: stored.logo || null,
                branding: {},
                workspace: stored.workspace || "default"
            },
            application: {
                id: stored.applicationId || null,
                code: null,
                name: null,
                version: null
            },
            theme: stored.theme || "light",
            locale: "id",
            authenticated: !!stored.userId
        };

        this._initialized = true;
        this._notify();
        return true;
    }

    /**
     * Refresh session data (re-read from storage).
     * @returns {boolean}
     */
    refresh() {
        return this.restore();
    }

    /**
     * Destroy the session.
     */
    destroy() {
        _state = _deepClone(DEFAULT_STATE);
        companySession.destroy();
        branding.clear();
        this._initialized = false;
        this._notify();
    }

    /**
     * Convenience: Create session from flat data (backward compat).
     * @param {object} flat - Flat session data
     */
    init(flat = {}) {
        return this.create({
            user: {
                id: flat.user?.id || flat.userId || null,
                name: flat.user?.name || null,
                email: flat.user?.email || null,
                role: flat.user?.role || flat.role || null,
                permissions: flat.user?.permissions || flat.permissions || []
            },
            company: {
                id: flat.company?.id || flat.companyId || flat.companyData?.id || null,
                code: flat.company?.code || flat.companyCode || null,
                name: flat.company?.name || flat.companyName || flat.companyCode || null,
                type: flat.company?.type || flat.companyData?.jenis || null,
                logo: flat.company?.logo || flat.companyData?.logo || null,
                branding: flat.company?.branding || flat.companyData || {},
                workspace: flat.company?.workspace || flat.companyData?.workspace || "default"
            },
            application: {
                id: flat.application?.id || null,
                code: flat.applicationId || null,
                name: flat.application?.name || null,
                version: flat.application?.version || null
            },
            theme: flat.theme || "light",
            locale: flat.locale || "id",
            authenticated: flat.authenticated !== undefined ? flat.authenticated : !!flat.user?.id
        });
    }

    /**
     * Check if session is initialized.
     * @returns {boolean}
     */
    isReady() {
        return this._initialized;
    }

    /**
     * Check if authenticated.
     * @returns {boolean}
     */
    isAuthenticated() {
        return _state.authenticated && !!_state.user.id;
    }

    /**
     * Subscribe to session changes.
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

    /**
     * Convert session to JSON.
     * @returns {object}
     */
    toJSON() {
        return _deepClone(_state);
    }

    /** @private */
    _notify() {
        const snapshot = this.getState();
        _listeners.forEach(fn => {
            try { fn(snapshot); } catch (e) {
                console.warn("[SMART.Session] Subscriber error:", e);
            }
        });
    }
}

function _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// ── Singleton ──
export const session = new SmartSession();
export default session;
