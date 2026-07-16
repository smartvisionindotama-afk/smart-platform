/**
 * FrameworkContext — Single Source of Truth for SMART Platform.
 *
 * Consolidates Auth, Company, Branding, Permission, and Session
 * into one unified context object.
 *
 * Updated to use SMART.Session for company session state.
 *
 * @module @smart/core/context
 */

import Auth from "../auth/auth.js";
import Permission from "../permission/permission.js";
import { companyManager } from "../company/company-manager.js";
import { companySession } from "../company/company-session.js";
import { branding } from "../company/branding.js";
import { session } from "../session/index.js";

/**
 * @typedef {object} FrameworkState
 * @property {object|null} user Current user { id, name, email, role, institution }
 * @property {object|null} company Current company { code, name, data }
 * @property {object|null} branding Current branding { logo, favicon, companyName, appName, workspace, theme }
 * @property {object|null} role Current role { name, level, permissions }
 * @property {string[]} permissions Effective permission list
 * @property {string|null} token Session token
 * @property {object|null} session Session info { token, loginTime, expiresAt }
 * @property {string} workspace Active workspace name
 * @property {string} theme Active theme ("light" | "dark")
 * @property {boolean} isLoggedIn Whether user is authenticated
 */

/**
 * FrameworkContext class.
 * Provides a unified snapshot of the entire framework state.
 */
class FrameworkContext {
    constructor() {
        this._listeners = [];
        this._syncFn = null;

        // Subscribe to auth changes
        Auth.onChange(() => this._notify());
        // Subscribe to company session changes
        companySession.onChange(() => this._notify());
        // Subscribe to company manager changes
        companyManager.onChange(() => this._notify());
        // Subscribe to branding changes
        branding.onChange(() => this._notify());
        // Subscribe to permission changes
        Permission.onChange(() => this._notify());
    }

    /**
     * Get a snapshot of the entire framework state.
     * @returns {FrameworkState}
     */
    getState() {
        const user = Auth.user();
        const token = Auth.token();
        const role = user ? Permission.currentRole() : null;
        const effectivePermissions = user ? Permission.menu() : [];
        const sessionState = session.getState();
        const company = {
            code: sessionState.companyCode,
            name: sessionState.companyName,
            data: sessionState.companyId ? { ...sessionState } : null
        };
        const brand = branding.getBranding();

        return {
            user,
            company,
            branding: brand,
            role,
            permissions: effectivePermissions,
            token,
            session: Auth.session(),
            workspace: sessionState.workspace || brand.workspace,
            theme: sessionState.theme || brand.theme,
            isLoggedIn: Auth.isLoggedIn()
        };
    }

    /**
     * Get current user.
     * @returns {object|null}
     */
    getUser() {
        return Auth.user();
    }

    /**
     * Get current company info.
     * @returns {{ code: string|null, name: string|null, data: object|null }}
     */
    getCompany() {
        const s = session.getState();
        return {
            code: s.companyCode,
            name: s.companyName,
            data: s.companyId ? { ...s } : null
        };
    }

    /**
     * Get current branding.
     * @returns {object}
     */
    getBranding() {
        return branding.getBranding();
    }

    /**
     * Check if current user has a permission.
     * @param {string} permission
     * @returns {boolean}
     */
    can(permission) {
        return Permission.can(permission);
    }

    /**
     * Check if user is logged in.
     * @returns {boolean}
     */
    isLoggedIn() {
        return Auth.isLoggedIn();
    }

    /**
     * Subscribe to context changes.
     * @param {function} callback Receives FrameworkState
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
     * Set a sync function that runs on every context change.
     * @param {function} fn Async function receiving FrameworkState
     */
    setSync(fn) {
        this._syncFn = fn;
    }

    /** @private */
    _notify() {
        const state = this.getState();
        this._listeners.forEach(fn => {
            try { fn(state); } catch (e) {
                console.warn("[FrameworkContext] Subscriber error:", e);
            }
        });
        if (this._syncFn) {
            try { this._syncFn(state); } catch (e) {
                console.warn("[FrameworkContext] Sync error:", e);
            }
        }
    }
}

// ── Singleton instance ──
export const framework = new FrameworkContext();
export default framework;
