/**
 * Company Context — Multi-tenant data isolation.
 *
 * Provides framework-level company context management.
 * Every user/data entity is scoped to a company.
 * This module provides the current company context
 * and helper functions to tag/filter data by company.
 *
 * All SMART applications use the same class.
 * 
 * @module @smart/core/company
 */

/** @type {string|null} Current company code (e.g. "CMP-001") */
let _currentCompanyCode = null;

/** @type {string|null} Current company name for display */
let _currentCompanyName = null;

/** @type {object|null} Current company full data object */
let _currentCompanyData = null;

/**
 * CompanyManager — Enhanced company context management.
 * Provides storage, resolution, and settings access.
 */
class CompanyManager {
    /**
     * @param {object} [options]
     * @param {object} [options.storage] Optional storage backend (e.g., localStorage)
     */
    constructor(options = {}) {
        this._storage = options.storage || null;
        this._listeners = [];
    }

    /**
     * Get current company code.
     * @returns {string|null}
     */
    getCode() {
        return _currentCompanyCode;
    }

    /**
     * Get current company name.
     * @returns {string|null}
     */
    getName() {
        return _currentCompanyName;
    }

    /**
     * Get current company full data.
     * @returns {object|null}
     */
    getData() {
        return _currentCompanyData ? { ..._currentCompanyData } : null;
    }

    /**
     * Set current company context.
     * @param {string} code Company code
     * @param {string} [name] Display name
     * @param {object} [data] Full company data
     */
    setContext(code, name, data = null) {
        _currentCompanyCode = code;
        _currentCompanyName = name || code;
        _currentCompanyData = data ? { ...data } : null;
        this._notify();
    }

    /**
     * Clear company context (e.g., on logout).
     */
    clear() {
        _currentCompanyCode = null;
        _currentCompanyName = null;
        _currentCompanyData = null;
        this._notify();
    }

    /**
     * Check if a company context is active.
     * @returns {boolean}
     */
    hasContext() {
        return _currentCompanyCode !== null;
    }

    /**
     * Tag data object with current company code.
     * @param {object} data
     * @returns {object}
     */
    tagData(data) {
        if (!_currentCompanyCode) return { ...data };
        return { ...data, companyCode: _currentCompanyCode };
    }

    /**
     * Filter items array by current company.
     * @param {object[]} items
     * @returns {object[]}
     */
    filterItems(items) {
        if (!_currentCompanyCode) return items;
        return items.filter(item => item.companyCode === _currentCompanyCode);
    }

    /**
     * Subscribe to context changes.
     * @param {function} callback
     * @returns {function} Unsubscribe function
     */
    onChange(callback) {
        this._listeners.push(callback);
        return () => {
            const idx = this._listeners.indexOf(callback);
            if (idx !== -1) this._listeners.splice(idx, 1);
        };
    }

    /**
     * Resolve company data from a provider function.
     * @param {function} provider Async function that returns company data
     * @returns {Promise<object|null>}
     */
    async resolve(provider) {
        if (typeof provider !== "function") return null;
        try {
            const data = await provider(_currentCompanyCode);
            if (data) {
                _currentCompanyData = { ...data };
                this._notify();
                return data;
            }
        } catch (e) {
            console.warn("[CompanyManager] Resolve error:", e);
        }
        return null;
    }

    /** @private */
    _notify() {
        const snapshot = {
            code: _currentCompanyCode,
            name: _currentCompanyName,
            data: _currentCompanyData ? { ..._currentCompanyData } : null
        };
        this._listeners.forEach(fn => {
            try { fn(snapshot); } catch (e) {
                console.warn("[CompanyManager] Subscriber error:", e);
            }
        });
    }
}

// ── Singleton instance ──
export const companyManager = new CompanyManager();
export default companyManager;

// ── Backward-compatible function API ──

/**
 * Set the current company context.
 * Called after login with the resolved company for the user.
 *
 * @param {string} companyCode e.g. "CMP-001"
 * @param {string} [companyName] Display name
 */
export function setCompanyContext(companyCode, companyName) {
    _currentCompanyCode = companyCode;
    _currentCompanyName = companyName || companyCode;
}

/**
 * Get the current company code.
 * @returns {string|null}
 */
export function getCompanyCode() {
    return _currentCompanyCode;
}

/**
 * Get the current company name.
 * @returns {string|null}
 */
export function getCompanyName() {
    return _currentCompanyName;
}

/**
 * Clear company context (e.g. on logout).
 */
export function clearCompanyContext() {
    _currentCompanyCode = null;
    _currentCompanyName = null;
    _currentCompanyData = null;
}

/**
 * Check if a company context is active.
 * @returns {boolean}
 */
export function hasCompanyContext() {
    return _currentCompanyCode !== null;
}

/**
 * Tag data with the current company code.
 * Returns data with companyCode added/overridden.
 *
 * @param {object} data
 * @returns {object}
 */
export function tagWithCompany(data) {
    if (!_currentCompanyCode) return { ...data };
    return { ...data, companyCode: _currentCompanyCode };
}

/**
 * Filter an array of items to only include those
 * belonging to the current company.
 *
 * @param {object[]} items
 * @returns {object[]}
 */
export function filterByCompany(items) {
    if (!_currentCompanyCode) return items;
    return items.filter(item => item.companyCode === _currentCompanyCode);
}
