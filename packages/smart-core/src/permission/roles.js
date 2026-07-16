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

/**
 * Namespace-based permission definitions.
 *
 * Format: {application}.{resource}.{action}
 *
 * Contoh:
 *   inventory.dashboard.view
 *   inventory.barang.read
 *   inventory.barang.create
 *   inventory.barang.update
 *   inventory.barang.delete
 *   inventory.stock.adjust
 *   inventory.stock.opname
 *   settings.company.edit
 *   settings.user.manage
 *   settings.permission.manage
 *   settings.role.manage
 *
 * Permission lintas aplikasi harus konsisten.
 */

const roleDefinitions = {

    viewer: {

        name: "Viewer",

        level: 10,

        permissions: [

            "inventory.dashboard.view",

            "inventory.barang.read",

            "inventory.supplier.read",

            "inventory.pembelian.read",

            "inventory.report.view"

        ]

    },


    operator: {

        name: "Operator Gudang",

        level: 30,

        permissions: [

            "inventory.barang.create",

            "inventory.pembelian.create",

            "inventory.stock.adjust"

        ]

    },


    manager: {

        name: "Manager",

        level: 70,

        permissions: [

            "inventory.barang.update",

            "inventory.supplier.create",

            "inventory.pembelian.approve",

            "inventory.stock.opname"

        ]

    },


    owner: {

        name: "Owner",

        level: 100,

        permissions: [

            "inventory.barang.delete",

            "inventory.supplier.delete",

            "settings.company.edit",

            "settings.user.manage",

            "settings.permission.manage",

            "settings.role.manage",

            "inventory.report.export",

            "*"

        ]

    },


    superadmin: {

        name: "Super Admin",

        level: 200,

        permissions: ["*"]

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
