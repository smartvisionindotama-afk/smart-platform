/**
 * Company Storage — Storage abstraction layer for SMART Platform.
 *
 * Provides unified localStorage/sessionStorage with fallback to in-memory.
 * Used by Company SDK for persisting session and branding data.
 *
 * @module @smart/core/company/company-storage
 */

const _memoryStore = new Map();

/**
 * SmartStorage — storage with automatic fallback.
 * Tries localStorage first, falls back to in-memory Map.
 */
class SmartStorage {
    /**
     * @param {string} prefix Key prefix (default: "smart_company_")
     */
    constructor(prefix = "smart_company_") {
        this._prefix = prefix;
        this._available = _checkStorage();
    }

    /**
     * Get a value from storage.
     * @param {string} key
     * @returns {*|null}
     */
    get(key) {
        const fullKey = this._prefix + key;
        if (this._available) {
            try {
                const raw = localStorage.getItem(fullKey);
                return raw ? JSON.parse(raw) : null;
            } catch {
                // Fall through to memory
            }
        }
        return _memoryStore.has(fullKey) ? _memoryStore.get(fullKey) : null;
    }

    /**
     * Set a value in storage.
     * @param {string} key
     * @param {*} value
     */
    set(key, value) {
        const fullKey = this._prefix + key;
        if (this._available) {
            try {
                localStorage.setItem(fullKey, JSON.stringify(value));
                return;
            } catch {
                // Fall through to memory
            }
        }
        _memoryStore.set(fullKey, value);
    }

    /**
     * Remove a value from storage.
     * @param {string} key
     */
    remove(key) {
        const fullKey = this._prefix + key;
        if (this._available) {
            try {
                localStorage.removeItem(fullKey);
            } catch {
                // ignore
            }
        }
        _memoryStore.delete(fullKey);
    }

    /**
     * Clear all values with this prefix from storage.
     */
    clear() {
        if (this._available) {
            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(this._prefix)) {
                        keysToRemove.push(k);
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
            } catch {
                // ignore
            }
        }
        for (const key of _memoryStore.keys()) {
            if (key.startsWith(this._prefix)) {
                _memoryStore.delete(key);
            }
        }
    }
}

/**
 * Check if localStorage is available.
 * @returns {boolean}
 */
function _checkStorage() {
    try {
        const key = "__smart_test__";
        localStorage.setItem(key, "1");
        localStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

// ── Singleton instance ──
export const companyStorage = new SmartStorage();
export default companyStorage;
