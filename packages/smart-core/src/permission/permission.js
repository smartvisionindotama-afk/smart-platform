import Auth from "../auth/auth.js";
import {
    can as matchCan,
    canAny as matchCanAny,
    canAll as matchCanAll
} from "./engine.js";
import {
    getEffectivePermissions,
    getRole,
    listRoles,
    grantPermission as grantRolePermission,
    revokePermission as revokeRolePermission
} from "./roles.js";


/**
 * Permission Manager — user-aware permission checking facade.
 *
 * Maintains backward compatibility with the original Permission API
 * while adding RBAC with hierarchy, wildcards, and dynamic permission management.
 */
class Permission {


    constructor() {

        this._overrides = null;

        this._listeners = [];

    }



    // ── Permission Checking ──


    /**
     * Check if the current user has a specific permission.
     *
     * @param {string} permission e.g. "barang.create"
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


        return getRole(user.role);

    }


    /**
     * Get a role definition by name.
     *
     * @param {string} name
     * @returns {object|null}
     */
    role(name) {

        return getRole(name);

    }


    /**
     * List all defined roles.
     *
     * @returns {object}
     */
    roles() {

        return listRoles();

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



    // ── Dynamic Permission Management ──


    /**
     * Dynamically add a permission to a role.
     *
     * @param {string} roleName
     * @param {string} permission
     * @returns {boolean}
     */
    grant(roleName, permission) {

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
     * Dynamically remove a permission from a role.
     *
     * @param {string} roleName
     * @param {string} permission
     * @returns {boolean}
     */
    revoke(roleName, permission) {

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
     * 2. Role-based permissions (with hierarchy)
     *
     * @returns {string[]}
     */
    _getEffectivePermissions() {

        if (this._overrides) {

            return this._overrides;

        }


        const user = Auth.user();


        if (!user) return [];


        return getEffectivePermissions(
            user.role
        );

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
