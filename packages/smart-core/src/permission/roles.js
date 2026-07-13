/**
 * Role definitions with hierarchy.
 *
 * Each role has:
 * - name: Display label
 * - level: Hierarchy position (higher = more authority)
 * - permissions: Array of permission strings
 *
 * A role at a higher level implicitly inherits all permissions
 * from roles at lower levels.
 */

const roleDefinitions = {

    viewer: {

        name: "Viewer",

        level: 10,

        permissions: [

            "dashboard.view",

            "barang.view",

            "supplier.view",

            "pembelian.view",

            "report.view"

        ]

    },


    operator: {

        name: "Operator Gudang",

        level: 30,

        permissions: [

            "barang.create",

            "pembelian.create"

        ]

    },


    manager: {

        name: "Manager",

        level: 70,

        permissions: [

            "barang.update",

            "supplier.create",

            "pembelian.approve"

        ]

    },


    owner: {

        name: "Owner",

        level: 100,

        permissions: [

            "barang.delete",

            "supplier.delete",

            "setting.manage",

            "user.manage",

            "report.export",

            "*"

        ]

    }

};


/**
 * Get all permissions for a role, including inherited ones.
 *
 * @param {string} roleName
 * @returns {string[]} Flattened, deduplicated permission list
 */
export function getEffectivePermissions(roleName) {

    const role = roleDefinitions[roleName];

    if (!role) return [];


    const allPermissions = [];

    const roleLevels = Object.entries(roleDefinitions)

        .sort(([, a], [, b]) => a.level - b.level);


    for (const [name, def] of roleLevels) {

        if (def.level <= role.level) {

            allPermissions.push(...def.permissions);

        }

    }


    return [...new Set(allPermissions)];

}


/**
 * Get a role definition by name.
 *
 * @param {string} name
 * @returns {object|null}
 */
export function getRole(name) {

    return roleDefinitions[name] || null;

}


/**
 * List all available roles.
 *
 * @returns {object} Copy of role definitions
 */
export function listRoles() {

    return { ...roleDefinitions };

}


/**
 * Dynamically add a permission to a role.
 *
 * @param {string} roleName
 * @param {string} permission
 * @returns {boolean} Whether the permission was added
 */
export function grantPermission(roleName, permission) {

    const role = roleDefinitions[roleName];

    if (!role) return false;


    if (!role.permissions.includes(permission)) {

        role.permissions.push(permission);

    }


    return true;

}


/**
 * Dynamically remove a permission from a role.
 *
 * @param {string} roleName
 * @param {string} permission
 * @returns {boolean} Whether the permission was removed
 */
export function revokePermission(roleName, permission) {

    const role = roleDefinitions[roleName];

    if (!role) return false;


    const index = role.permissions.indexOf(permission);

    if (index === -1) return false;


    role.permissions.splice(index, 1);

    return true;

}


export default roleDefinitions;
