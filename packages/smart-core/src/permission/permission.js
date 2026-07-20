/**
 * Permission Manager — user-aware permission checking facade.
 *
 * Permissions are loaded dynamically from the server (MongoDB)
 * after login. Falls back to hardcoded roleDefinitions only
 * when server data is unavailable.
 *
 * Priority:
 * 1. Override (if set, for testing)
 * 2. Dynamic permissions from server (getEffectivePermissions)
 * 3. Hardcoded roleDefinitions fallback
 */

import Auth from "../auth/auth.js";
import {
    can as matchCan,
    canAny as matchCanAny,
    canAll as matchCanAll
} from "./engine.js";
import {
    getEffectivePermissions as getHardcodedPermissions,
    getRole as getHardcodedRole,
    listRoles as listHardcodedRoles,
    grantPermission as grantRolePermission,
    revokePermission as revokeRolePermission
} from "./roles.js";


/**
 * @typedef {object} DynamicRoleData
 * @property {string} name  Role identifier (e.g. "admin")
 * @property {string} label Display name (e.g. "Admin")
 * @property {number} level Hierarchy level
 * @property {string[]} permissions Granted permissions
 */


class Permission {

    constructor() {

        this._overrides = null;

        this._listeners = [];

        /**
         * Dynamic role→permissions map from server.
         * Structure: { roleName: { name, label, level, permissions } }
         * @type {Record<string, DynamicRoleData>}
         */
        this._dynamicRoles = {};

    }


    // ── Dynamic Permission Loading ──


    /**
     * Load roles & permissions from server data.
     *
     * Call this after login with data from GET /api/permissions/roles.
     *
     * @param {Array<{name:string, label:string, level:number, permissions:string[]}>} rolesData
     */
    loadPermissions(rolesData) {

        if (!Array.isArray(rolesData) || rolesData.length === 0) {

            console.warn("[Permission] No server permissions data");

            return;

        }


        const map = {};

        for (const r of rolesData) {

            map[r.name] = {

                name: r.name,

                label: r.label || r.name,

                level: Number(r.level) || 0,

                permissions: Array.isArray(r.permissions) ? r.permissions : []

            };

        }


        this._dynamicRoles = map;


        console.log(

            `[Permission] Loaded ${Object.keys(map).length} roles from server`

        );


        this._notify();

    }


    /**
     * Sync permissions from server API.
     *
     * Fetches roles with their permissions from the server and loads them
     * into the dynamic permissions cache. Any app can call this after login
     * so Permission.can() uses live data from MongoDB.
     *
     * Falls back gracefully if the server is unavailable or returns no data.
     *
     * @param {string} [apiUrl="/api/permissions/roles"] Server endpoint URL
     * @returns {Promise<boolean>} Whether sync was successful
     */
    async syncFromServer(apiUrl) {

        const url = apiUrl || "/api/permissions/roles";

        try {

            const res = await fetch(url);

            if (!res.ok) {

                console.warn(`[Permission] Server returned ${res.status} from ${url}`);

                return false;

            }


            const data = await res.json();

            const roles = data?.data || data || [];

            if (!Array.isArray(roles) || roles.length === 0) {

                console.warn("[Permission] No role permissions data from server");

                return false;

            }


            this.loadPermissions(roles);

            return true;

        } catch (e) {

            console.warn("[Permission] Could not fetch server permissions:", e);

            return false;

        }

    }


    /**
     * Check if dynamic permissions are available.
     * @returns {boolean}
     */
    hasDynamicPermissions() {

        return Object.keys(this._dynamicRoles).length > 0;

    }


    // ── Permission Checking ──


    /**
     * Check if the current user has a specific permission.
     *
     * @param {string} permission e.g. "inventory.dashboard.view"
     * @returns {boolean}
     */
    can(permission) {

        const effective =

            this._getEffectivePermissions();


        return matchCan(

            effective,

            permission

        );

    }


    /**
     * Check if the current user has ANY of the given permissions.
     *
     * @param {string[]} permissions
     * @returns {boolean}
     */
    canAny(permissions) {

        const effective =

            this._getEffectivePermissions();


        return matchCanAny(

            effective,

            permissions

        );

    }


    /**
     * Check if the current user has ALL of the given permissions.
     *
     * @param {string[]} permissions
     * @returns {boolean}
     */
    canAll(permissions) {

        const effective =

            this._getEffectivePermissions();


        return matchCanAll(

            effective,

            permissions

        );

    }


    // ── Role Information ──


    /**
     * Get the current user's role object.
     *
     * @returns {object|null}
     */
    currentRole() {

        const user = Auth.user();


        if (!user) return null;

        const roleName = user.role;


        // Check dynamic roles first
        if (this._dynamicRoles[roleName]) {

            const dr = this._dynamicRoles[roleName];

            return { name: dr.label, level: dr.level };

        }


        // Fallback to hardcoded
        return getHardcodedRole(roleName);

    }


    /**
     * Get a role definition by name.
     *
     * @param {string} name
     * @returns {object|null}
     */
    role(name) {

        // Check dynamic first
        if (this._dynamicRoles[name]) {

            const dr = this._dynamicRoles[name];

            return { name: dr.label, level: dr.level };

        }


        return getHardcodedRole(name);

    }


    /**
     * List all defined roles.
     *
     * @returns {object}
     */
    roles() {

        // If dynamic data available, return it
        if (this.hasDynamicPermissions()) {

            const result = {};

            for (const [key, val] of Object.entries(this._dynamicRoles)) {

                result[key] = { name: val.label, level: val.level };

            }

            return result;

        }


        return listHardcodedRoles();

    }


    /**
     * Get all permissions visible to the current user's role,
     * including inherited permissions.
     *
     * @returns {string[]}
     */
    menu() {

        const user = Auth.user();


        if (!user) return [];


        return this._getEffectivePermissions();

    }


    // ── Dynamic Permission Management (local only) ──


    /**
     * Dynamically add a permission to a role (local).
     *
     * @param {string} roleName
     * @param {string} permission
     * @returns {boolean}
     */
    grant(roleName, permission) {

        // If dynamic roles exist, update them locally
        if (this._dynamicRoles[roleName]) {

            const perms = this._dynamicRoles[roleName].permissions;

            if (!perms.includes(permission)) {

                perms.push(permission);

                this._notify();

            }

            return true;

        }


        const result = grantRolePermission(

            roleName,

            permission

        );


        if (result) {

            this._notify();

        }


        return result;

    }


    /**
     * Dynamically remove a permission from a role (local).
     *
     * @param {string} roleName
     * @param {string} permission
     * @returns {boolean}
     */
    revoke(roleName, permission) {

        // If dynamic roles exist, update them locally
        if (this._dynamicRoles[roleName]) {

            const perms = this._dynamicRoles[roleName].permissions;

            const idx = perms.indexOf(permission);

            if (idx !== -1) {

                perms.splice(idx, 1);

                this._notify();

                return true;

            }

            return false;

        }


        const result = revokeRolePermission(

            roleName,

            permission

        );


        if (result) {

            this._notify();

        }


        return result;

    }


    /**
     * Override the current user's permissions (for testing or admin mode).
     *
     * @param {string[]|null} permissions null to clear override
     */
    setOverride(permissions) {

        this._overrides =

            Array.isArray(permissions)

                ? [...permissions]

                : null;


        this._notify();

    }


    // ── Subscriptions ──


    /**
     * Subscribe to permission changes.
     *
     * @param {function} callback
     * @returns {function} Unsubscribe function
     */
    onChange(callback) {

        this._listeners.push(callback);


        return () => {

            const index =

                this._listeners.indexOf(callback);


            if (index !== -1) {

                this._listeners.splice(index, 1);

            }

        };

    }


    // ── Internal ──


    /**
     * Get the effective permission list for the current user.
     *
     * Priority:
     * 1. Override (if set)
     * 2. Dynamic permissions from server (with hierarchy)
     * 3. Hardcoded roleDefinitions fallback
     *
     * @returns {string[]}
     */
    _getEffectivePermissions() {

        if (this._overrides) {

            return this._overrides;

        }


        const user = Auth.user();


        if (!user) return [];


        const roleName = user.role;


        // Priority 2: dynamic permissions from server
        if (this.hasDynamicPermissions()) {

            const dynamicPerms = this._getEffectiveFromDynamic(roleName);

            // If dynamic result is not empty, use it (server data is authoritative)
            if (dynamicPerms.length > 0) {

                return dynamicPerms;

            }

            // Dynamic data exists but user's role has no permissions configured yet.
            // Fall through to hardcoded so existing roles still work.
            console.log(`[Permission] Role "${roleName}" has no server permissions, using fallback`);

        }


        // Priority 3: hardcoded fallback
        return getHardcodedPermissions(roleName);

    }


    /**
     * Build effective permissions from dynamic role data with hierarchy.
     *
     * A role inherits all permissions from roles at lower or equal levels.
     *
     * @param {string} roleName
     * @returns {string[]}
     */
    _getEffectiveFromDynamic(roleName) {

        const userRole = this._dynamicRoles[roleName];

        if (!userRole) return [];


        // Sort roles by level ascending
        const sorted = Object.entries(this._dynamicRoles)

            .sort(([, a], [, b]) => a.level - b.level);


        const allPermissions = [];

        for (const [, def] of sorted) {

            if (def.level <= userRole.level) {

                allPermissions.push(...def.permissions);

            }

        }


        return [...new Set(allPermissions)];

    }


    /**
     * Notify all subscribers of permission changes.
     */
    _notify() {

        const permissions =

            this._getEffectivePermissions();


        this._listeners.forEach(fn => {

            try {

                fn(permissions);

            } catch (e) {

                console.warn(

                    "Permission subscriber error:",

                    e

                );

            }

        });

    }

}


export default new Permission();
