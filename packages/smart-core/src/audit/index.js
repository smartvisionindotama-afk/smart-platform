/**
 * Audit Log — Records all platform activities.
 *
 * Tracks impersonation events, login/logout, and other admin actions.
 * Stores records in memory (optionally syncs to server).
 *
 * @module @smart/core/audit
 */

/**
 * @typedef {object} AuditEntry
 * @property {string} id Unique entry ID
 * @property {string} action Action name (e.g. "impersonation.start", "impersonation.end", "login", "logout")
 * @property {string} actorId User who performed the action
 * @property {string} actorName Display name of the actor
 * @property {string|null} companyId Target company (if applicable)
 * @property {string|null} application Target application (if applicable)
 * @property {string|null} details Additional details
 * @property {number} timestamp When the action occurred
 * @property {string|null} ipAddress Client IP address (if available)
 */

let _entries = [];
let _entryIdCounter = 0;

/**
 * AuditLogger — records and retrieves audit entries.
 */
class AuditLogger {
    constructor() {
        this._listeners = [];
        this._syncFn = null;
    }

    /**
     * Log an audit entry.
     * @param {object} entry
     * @param {string} entry.action
     * @param {string} entry.actorId
     * @param {string} entry.actorName
     * @param {string} [entry.companyId]
     * @param {string} [entry.application]
     * @param {string} [entry.details]
     * @param {string} [entry.ipAddress]
     * @returns {AuditEntry}
     */
    log({ action, actorId, actorName, companyId = null, application = null, details = null, ipAddress = null }) {
        const entry = {
            id: String(++_entryIdCounter),
            action,
            actorId,
            actorName,
            companyId,
            application,
            details,
            ipAddress,
            timestamp: Date.now()
        };
        _entries.unshift(entry);
        this._notify(entry);
        if (this._syncFn) {
            try { this._syncFn(entry); } catch (e) {
                console.warn("[AuditLogger] Sync error:", e);
            }
        }
        return { ...entry };
    }

    /**
     * Convenience: Log impersonation start.
     * @param {object} info
     * @returns {AuditEntry}
     */
    logImpersonationStart({ superAdminId, superAdminName, companyId, application, ipAddress }) {
        return this.log({
            action: "impersonation.start",
            actorId: superAdminId,
            actorName: superAdminName,
            companyId,
            application,
            details: `Super Admin ${superAdminName} started impersonation for company ${companyId}`,
            ipAddress
        });
    }

    /**
     * Convenience: Log impersonation end.
     * @param {object} info
     * @returns {AuditEntry}
     */
    logImpersonationEnd({ superAdminId, superAdminName, companyId, application, ipAddress }) {
        return this.log({
            action: "impersonation.end",
            actorId: superAdminId,
            actorName: superAdminName,
            companyId,
            application,
            details: `Super Admin ${superAdminName} ended impersonation for company ${companyId}`,
            ipAddress
        });
    }

    /**
     * Convenience: Log user login.
     * @param {object} info
     * @returns {AuditEntry}
     */
    logLogin({ userId, userName, companyId, application, ipAddress }) {
        return this.log({
            action: "login",
            actorId: userId,
            actorName: userName,
            companyId,
            application,
            details: `${userName} logged in`,
            ipAddress
        });
    }

    /**
     * Convenience: Log user logout.
     * @param {object} info
     * @returns {AuditEntry}
     */
    logLogout({ userId, userName, companyId, application, ipAddress }) {
        return this.log({
            action: "logout",
            actorId: userId,
            actorName: userName,
            companyId,
            application,
            details: `${userName} logged out`,
            ipAddress
        });
    }

    /**
     * Get all audit entries, optionally filtered.
     * @param {object} [filters]
     * @param {number} [filters.limit=100]
     * @param {string} [filters.action] Filter by action
     * @param {string} [filters.companyId] Filter by company
     * @returns {AuditEntry[]}
     */
    getEntries(filters = {}) {
        let result = [..._entries];
        const { limit = 100, action, companyId } = filters;
        if (action) result = result.filter(e => e.action === action);
        if (companyId) result = result.filter(e => e.companyId === companyId);
        return result.slice(0, limit);
    }

    /**
     * Clear all entries (e.g., on logout).
     */
    clear() {
        _entries = [];
    }

    /**
     * Set a sync function that runs on every new entry.
     * @param {function} fn Async function receiving AuditEntry
     */
    setSync(fn) {
        this._syncFn = fn;
    }

    /**
     * Subscribe to new audit entries.
     * @param {function} callback Receives AuditEntry
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
    _notify(entry) {
        this._listeners.forEach(fn => {
            try { fn(entry); } catch (e) {
                console.warn("[AuditLogger] Subscriber error:", e);
            }
        });
    }
}

// ── Singleton ──
export const audit = new AuditLogger();
export default audit;
