/**
 * Impersonation Manager — Super Admin Login As Company Admin.
 *
 * Manages temporary impersonation sessions where a Super Admin
 * can act as a Company Admin without knowing their password.
 *
 * Stores session info including who impersonated, which company,
 * which application, and expiry.
 *
 * @module @smart/core/impersonation
 */

/**
 * @typedef {object} ImpersonationSession
 * @property {string} superAdminId   ID of the Super Admin who initiated
 * @property {string} superAdminName Name of the Super Admin
 * @property {string} companyId      Company ID being impersonated
 * @property {string} companyName    Company name
 * @property {string} userId         User ID of the company admin being impersonated
 * @property {string} userName       Name of the impersonated admin
 * @property {string} application    Application slug (e.g. "inventory")
 * @property {string} role           Role being used (e.g. "owner")
 * @property {number} loginTime      Timestamp when impersonation started
 * @property {number} expiresAt      Timestamp when impersonation expires
 */

let _currentImpersonation = null;
let _listeners = [];

/**
 * ImpersonationManager — handles "Login As Company Admin" functionality.
 */
class ImpersonationManager {
    /**
     * Start an impersonation session.
     * @param {object} session Session data
     * @param {string} session.superAdminId
     * @param {string} session.superAdminName
     * @param {string} session.companyId
     * @param {string} session.companyName
     * @param {string} session.userId
     * @param {string} session.userName
     * @param {string} session.application
     * @param {string} [session.role="owner"]
     * @param {number} [ttlMs=3600000] Session TTL (default 1 hour)
     * @returns {ImpersonationSession}
     */
    start(session, ttlMs = 3600000) {
        const now = Date.now();
        _currentImpersonation = {
            superAdminId: session.superAdminId,
            superAdminName: session.superAdminName || "Super Admin",
            companyId: session.companyId,
            companyName: session.companyName || session.companyId,
            userId: session.userId,
            userName: session.userName || session.userId,
            application: session.application || "inventory",
            role: session.role || "owner",
            loginTime: now,
            expiresAt: now + ttlMs
        };
        this._notify("start");
        return this.getSession();
    }

    /**
     * End the current impersonation session.
     * @returns {boolean}
     */
    end() {
        if (!_currentImpersonation) return false;
        _currentImpersonation = null;
        this._notify("end");
        return true;
    }

    /**
     * Get current impersonation session (null if expired or not active).
     * @returns {ImpersonationSession|null}
     */
    getSession() {
        if (!_currentImpersonation) return null;
        if (Date.now() > _currentImpersonation.expiresAt) {
            _currentImpersonation = null;
            this._notify("expired");
            return null;
        }
        return { ..._currentImpersonation };
    }

    /**
     * Check if currently impersonating.
     * @returns {boolean}
     */
    isImpersonating() {
        return this.getSession() !== null;
    }

    /**
     * Get the Super Admin info who initiated the impersonation.
     * @returns {{ id: string, name: string }|null}
     */
    getSuperAdmin() {
        const session = this.getSession();
        if (!session) return null;
        return { id: session.superAdminId, name: session.superAdminName };
    }

    /**
     * Subscribe to impersonation changes.
     * @param {function} callback Receives event: "start" | "end" | "expired"
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
    _notify(event) {
        _listeners.forEach(fn => {
            try { fn(event, this.getSession()); } catch (e) {
                console.warn("[ImpersonationManager] Subscriber error:", e);
            }
        });
    }
}

// ── Singleton ──
export const impersonation = new ImpersonationManager();
export default impersonation;
