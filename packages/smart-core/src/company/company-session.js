/**
 * Company Session — Current company session manager.
 *
 * Manages the active company context as a session object.
 * Session menyimpan:
 *   - userId, companyId, companyCode, companyName, companyType
 *   - applicationId, workspace, role, permissions, logo, theme
 *
 * Digunakan oleh Company Manager dan SMART.Session.
 *
 * @module @smart/core/company/company-session
 */

import { companyStorage } from "./company-storage.js";

/**
 * @typedef {object} CompanySessionData
 * @property {string|null} userId        Current user ID
 * @property {string|null} companyId     Current company database ID
 * @property {string|null} companyCode   Current company code (e.g. "INV001")
 * @property {string|null} companyName   Current company display name
 * @property {string|null} companyType   Company type (PT, CV, etc.)
 * @property {string|null} applicationId Current application slug
 * @property {string|null} workspace     Current workspace name
 * @property {string|null} role          Current user role
 * @property {string[]}    permissions   Current user permissions
 * @property {string|null} logo          Company logo URL
 * @property {string|null} theme         Active theme ("light" | "dark")
 */

const STORAGE_KEY = "current_session";

/** @type {CompanySessionData} */
const DEFAULT_SESSION = {
    userId: null,
    companyId: null,
    companyCode: null,
    companyName: null,
    companyType: null,
    applicationId: null,
    workspace: "default",
    role: null,
    permissions: [],
    logo: null,
    theme: "light"
};

/** @type {CompanySessionData} */
let _session = { ...DEFAULT_SESSION };

/** @type {Function[]} */
let _listeners = [];

/**
 * CompanySession — manages the current company session.
 */
class CompanySession {
    /**
     * Create a new session with provided data.
     * Merges with defaults so missing fields get default values.
     *
     * @param {Partial<CompanySessionData>} data
     * @returns {CompanySessionData}
     */
    create(data = {}) {
        _session = {
            ...DEFAULT_SESSION,
            ...data,
            permissions: data.permissions || []
        };
        this.save();
        this._notify();
        return this.get();
    }

    /**
     * Get current session data (immutable snapshot).
     * @returns {CompanySessionData}
     */
    get() {
        return { ..._session };
    }

    /**
     * Get a specific field from the session.
     * @param {string} field
     * @returns {*}
     */
    getField(field) {
        return _session[field] ?? null;
    }

    /**
     * Update specific fields in the current session.
     * @param {Partial<CompanySessionData>} updates
     * @returns {CompanySessionData}
     */
    update(updates = {}) {
        _session = {
            ..._session,
            ...updates,
            permissions: updates.permissions || _session.permissions || []
        };
        this.save();
        this._notify();
        return this.get();
    }

    /**
     * Persist current session to storage.
     */
    save() {
        companyStorage.set(STORAGE_KEY, _session);
    }

    /**
     * Load session from storage.
     * @param {boolean} [restore=false] If true, also restore to memory
     * @returns {CompanySessionData|null}
     */
    load(restore = false) {
        const stored = companyStorage.get(STORAGE_KEY);
        if (!stored) return null;
        if (restore) {
            _session = { ...DEFAULT_SESSION, ...stored };
            this._notify();
        }
        return stored;
    }

    /**
     * Restore session from storage (load + set memory).
     * @returns {boolean}
     */
    restore() {
        const stored = this.load(true);
        return stored !== null;
    }

    /**
     * Destroy the current session (clear all data).
     */
    destroy() {
        _session = { ...DEFAULT_SESSION };
        companyStorage.remove(STORAGE_KEY);
        this._notify();
    }

    /**
     * Check if a company session is active.
     * @returns {boolean}
     */
    isActive() {
        return _session.companyCode !== null && _session.companyCode !== undefined;
    }

    /**
     * Subscribe to session changes.
     * @param {function} callback Receives CompanySessionData
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
     * Convert session to a plain object for serialization.
     * @returns {object}
     */
    toJSON() {
        return { ..._session };
    }

    /** @private */
    _notify() {
        const snapshot = this.get();
        _listeners.forEach(fn => {
            try { fn(snapshot); } catch (e) {
                console.warn("[CompanySession] Subscriber error:", e);
            }
        });
    }
}

// ── Singleton ──
export const companySession = new CompanySession();
export default companySession;
