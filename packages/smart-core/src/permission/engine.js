/**
 * Pure permission matching engine.
 *
 * Independent of Auth, role definitions, or any application state.
 * Takes a list of granted permissions and a required permission,
 * and returns whether access should be granted.
 *
 * Supports wildcard:
 * - "barang.*" matches any "barang.xxx" action
 * - "*" matches everything
 */


/**
 * Check if a required permission matches any in the granted list.
 *
 * Supports wildcard patterns:
 *   "barang.*"    → matches "barang.view", "barang.create", etc.
 *   "*"           → matches everything
 *   "barang.view" → exact match only
 *
 * @param {string[]} grantedPermissions List of permissions the user has
 * @param {string} requiredPermission   The permission to check
 * @returns {boolean}
 */
export function can(grantedPermissions, requiredPermission) {

    if (!grantedPermissions || !requiredPermission) {

        return false;

    }


    const permissions = Array.isArray(grantedPermissions)

        ? grantedPermissions

        : [];


    return permissions.some(granted =>

        matchPermission(granted, requiredPermission)

    );

}


/**
 * Check if ANY of the required permissions are granted.
 *
 * @param {string[]} grantedPermissions
 * @param {string[]} requiredPermissions
 * @returns {boolean}
 */
export function canAny(grantedPermissions, requiredPermissions) {

    if (!requiredPermissions || requiredPermissions.length === 0) {

        return false;

    }


    return requiredPermissions.some(req =>

        can(grantedPermissions, req)

    );

}


/**
 * Check if ALL of the required permissions are granted.
 *
 * @param {string[]} grantedPermissions
 * @param {string[]} requiredPermissions
 * @returns {boolean}
 */
export function canAll(grantedPermissions, requiredPermissions) {

    if (!requiredPermissions || requiredPermissions.length === 0) {

        return true;

    }


    return requiredPermissions.every(req =>

        can(grantedPermissions, req)

    );

}


/**
 * Match a single granted permission against a required permission.
 *
 * Rules:
 * - "*" granted matches anything
 * - "barang.*" matches "barang.view", "barang.create", etc.
 * - "barang.view" only matches "barang.view"
 *
 * @param {string} granted  A single permission from the user's list
 * @param {string} required The specific permission being checked
 * @returns {boolean}
 */
function matchPermission(granted, required) {

    if (granted === "*") return true;


    const parts = granted.split(".");

    const requiredParts = required.split(".");


    // Support wildcard at the action level: "resource.*"
    if (parts.length === 2 && parts[1] === "*") {

        return parts[0] === requiredParts[0];

    }


    // Exact match (also supports single-segment like "admin")
    return granted === required;

}
