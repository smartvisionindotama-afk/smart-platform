import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Auth from "../src/auth/auth.js";
import Permission from "../src/permission/permission.js";
import { can, canAny, canAll } from "../src/permission/engine.js";
import {
    getEffectivePermissions,
    getRole,
    listRoles,
    grantPermission,
    revokePermission
} from "../src/permission/roles.js";
import roleDefinitions from "../src/permission/roles.js";


// ── Test helpers ──

// Snapshot of original role permissions for test isolation
const originalPermissions = {};

function saveOriginalPermissions() {
    for (const [name, def] of Object.entries(roleDefinitions)) {
        originalPermissions[name] = [...def.permissions];
    }
}

function restoreOriginalPermissions() {
    for (const [name, def] of Object.entries(roleDefinitions)) {
        def.permissions = [...(originalPermissions[name] || [])];
    }
}

// One-time save before any tests
saveOriginalPermissions();

/**
 * Simulated server role-permission data for Permission Module tests.
 *
 * Di Enterprise RBAC, permissions berasal dari server (MongoDB)
 * dan di-load via Permission.loadPermissions() setelah login.
 *
 * Struktur data ini mencerminkan apa yang akan dikirim oleh endpoint
 * GET /api/permissions/roles.
 */
const testRoleData = [
    {
        name: "supervisor",
        label: "Supervisor",
        level: 10,
        permissions: [
            "inventory.dashboard.view",
            "inventory.barang.read",
            "inventory.supplier.read",
            "inventory.pembelian.read",
            "inventory.report.view"
        ]
    },
    {
        name: "operator",
        label: "Operator Gudang",
        level: 30,
        permissions: [
            "inventory.barang.create",
            "inventory.pembelian.create",
            "inventory.stock.adjust"
        ]
    },
    {
        name: "admin",
        label: "Admin",
        level: 70,
        permissions: [
            "inventory.barang.update",
            "inventory.supplier.create",
            "inventory.pembelian.approve",
            "inventory.stock.opname"
        ]
    },
    {
        name: "owner",
        label: "Owner",
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
    {
        name: "superadmin",
        label: "Super Admin",
        level: 200,
        permissions: ["*"]
    }
];


// ──────────────────────────────────────────────
// Engine: Pure permission matching
// ──────────────────────────────────────────────

describe("Permission Engine", () => {

    describe("can()", () => {

        it("should return true for exact match", () => {
            expect(can(["barang.view"], "barang.view")).toBe(true);
        });

        it("should return false for no match", () => {
            expect(can(["barang.view"], "barang.create")).toBe(false);
        });

        it("should return false for empty permissions", () => {
            expect(can([], "barang.view")).toBe(false);
        });

        it("should return false for null permissions", () => {
            expect(can(null, "barang.view")).toBe(false);
        });

        it("should return false for null required", () => {
            expect(can(["barang.view"], null)).toBe(false);
        });

        it("should match wildcard *", () => {
            expect(can(["*"], "anything.at.all")).toBe(true);
        });

        it("should match resource wildcard", () => {
            expect(can(["barang.*"], "barang.create")).toBe(true);
            expect(can(["barang.*"], "barang.delete")).toBe(true);
        });

        it("should not match different resource wildcard", () => {
            expect(can(["barang.*"], "supplier.view")).toBe(false);
        });

        it("should match among multiple permissions", () => {
            const perms = ["dashboard.view", "barang.view", "pembelian.view"];
            expect(can(perms, "dashboard.view")).toBe(true);
            expect(can(perms, "supplier.view")).toBe(false);
        });

    });


    describe("canAny()", () => {

        it("should return true if any permission matches", () => {
            const perms = ["barang.view", "barang.create"];
            expect(canAny(perms, ["barang.delete", "barang.view"])).toBe(true);
        });

        it("should return false if none match", () => {
            const perms = ["barang.view"];
            expect(canAny(perms, ["barang.delete", "barang.create"])).toBe(false);
        });

        it("should return false for empty required list", () => {
            expect(canAny(["barang.view"], [])).toBe(false);
        });

    });


    describe("canAll()", () => {

        it("should return true if all permissions match", () => {
            const perms = ["barang.view", "barang.create", "barang.update"];
            expect(canAll(perms, ["barang.view", "barang.create"])).toBe(true);
        });

        it("should return false if not all match", () => {
            const perms = ["barang.view", "barang.create"];
            expect(canAll(perms, ["barang.view", "barang.delete"])).toBe(false);
        });

        it("should return true for empty required list", () => {
            expect(canAll(["barang.view"], [])).toBe(true);
        });

    });

});


// ──────────────────────────────────────────────
// Roles: Role definitions and hierarchy
//
// NOTE: Di Enterprise RBAC, roleDefinitions di roles.js
// hanya berisi hierarki level. Permissions sekarang
// bersifat dinamis dari server (MongoDB).
// Hardcoded permissions di roles.js hanyalah fallback.
// ──────────────────────────────────────────────

describe("Roles", () => {

    afterEach(() => {
        restoreOriginalPermissions();
    });


    describe("getEffectivePermissions()", () => {

        it("should return empty for supervisor (permissions are dynamic)", () => {
            const perms = getEffectivePermissions("supervisor");
            expect(perms).toEqual([]);
        });

        it("should return inherited permissions for operator (dynamic only)", () => {
            const perms = getEffectivePermissions("operator");
            // Operator level 30 inherits from supervisor (level 10) + operator (level 30)
            // Both have empty permissions in hardcoded fallback
            expect(perms).toEqual([]);
        });

        it("should return inherited permissions for admin (dynamic only)", () => {
            const perms = getEffectivePermissions("admin");
            // Admin level 70 inherits from supervisor(10) + operator(30) + admin(70)
            // All have empty permissions in hardcoded fallback
            expect(perms).toEqual([]);
        });

        it("should include wildcard for owner (hardcoded fallback)", () => {
            const perms = getEffectivePermissions("owner");
            expect(perms).toContain("*");
            expect(perms.length).toBe(1);
        });

        it("should return empty array for unknown role", () => {
            expect(getEffectivePermissions("unknown")).toEqual([]);
        });

        it("should deduplicate permissions", () => {
            const perms = getEffectivePermissions("owner");
            const unique = new Set(perms);
            expect(perms.length).toBe(unique.size);
        });

    });


    describe("getRole()", () => {

        it("should return role definition", () => {
            const role = getRole("admin");
            expect(role).not.toBeNull();
            expect(role.name).toBe("Admin");
            expect(role.level).toBe(70);
        });

        it("should return null for unknown role", () => {
            expect(getRole("unknown")).toBeNull();
        });

    });


    describe("listRoles()", () => {

        it("should return all role definitions", () => {
            const roles = listRoles();
            expect(roles).toHaveProperty("supervisor");
            expect(roles).toHaveProperty("operator");
            expect(roles).toHaveProperty("admin");
            expect(roles).toHaveProperty("owner");
            expect(roles).toHaveProperty("superadmin");
            expect(Object.keys(roles).length).toBe(5);
        });

        it("should return a copy (not reference)", () => {
            const roles = listRoles();
            roles.supervisor = null;
            const rolesAgain = listRoles();
            expect(rolesAgain.supervisor).not.toBeNull();
        });

    });


    describe("grantPermission()", () => {

        it("should add permission to a role", () => {
            const result = grantPermission("supervisor", "inventory.report.export");
            expect(result).toBe(true);
            const perms = getEffectivePermissions("supervisor");
            expect(perms).toContain("inventory.report.export");
        });

        it("should not duplicate permissions", () => {
            grantPermission("supervisor", "dashboard.view");
            const perms = getEffectivePermissions("supervisor");
            const count = perms.filter(p => p === "dashboard.view").length;
            expect(count).toBe(1);
        });

        it("should return false for unknown role", () => {
            expect(grantPermission("unknown", "test")).toBe(false);
        });

    });


    describe("revokePermission()", () => {

        it("should remove permission from a role", () => {
            // Grant first so there's something to revoke
            grantPermission("supervisor", "test.perm");
            const result = revokePermission("supervisor", "test.perm");
            expect(result).toBe(true);
            const perms = getEffectivePermissions("supervisor");
            expect(perms).not.toContain("test.perm");
        });

        it("should return false for non-existent permission", () => {
            expect(revokePermission("supervisor", "nonexistent")).toBe(false);
        });

        it("should return false for unknown role", () => {
            expect(revokePermission("unknown", "test")).toBe(false);
        });

    });

});


// ──────────────────────────────────────────────
// Permission Module: User-aware facade
//
// Menggunakan Permission.loadPermissions() di beforeEach
// untuk mensimulasikan data role-permission dari server.
// Ini mencerminkan alur Enterprise RBAC:
//   1. Login → 2. Sync dari server → 3. Cek permission
// ──────────────────────────────────────────────

describe("Permission Module", () => {

    beforeEach(() => {
        Auth.logout();
        Permission.setOverride(null);
        restoreOriginalPermissions();
        // Load simulated server data — seperti setelah login + syncFromServer()
        Permission.loadPermissions(testRoleData);
    });

    // Pastikan loadPermissions sudah benar
    it("should have loaded dynamic permissions", () => {
        expect(Permission.hasDynamicPermissions()).toBe(true);
    });


    describe("can()", () => {

        it("should return false when not logged in", () => {
            expect(Permission.can("dashboard.view")).toBe(false);
        });

        it("should check permission for owner (wildcard)", () => {
            Auth.login("admin"); // role = owner
            // Owner has ["*"] via dynamic data
            expect(Permission.can("inventory.dashboard.view")).toBe(true);
            expect(Permission.can("inventory.barang.read")).toBe(true);
            expect(Permission.can("inventory.barang.create")).toBe(true);
        });

        it("should check operator permissions", () => {
            Auth.login("operator"); // role = operator
            // Operator inherits from supervisor(level 10) + operator(level 30)
            expect(Permission.can("inventory.dashboard.view")).toBe(true);
            expect(Permission.can("inventory.barang.read")).toBe(true);
            expect(Permission.can("inventory.barang.create")).toBe(true);
            // These are at admin level (70) — not inherited by operator (30)
            expect(Permission.can("inventory.barang.delete")).toBe(false);
            expect(Permission.can("inventory.supplier.create")).toBe(false);
        });

    });


    describe("canAny()", () => {

        it("should return true if any permission matches", () => {
            Auth.login("operator");
            // barang.delete → false, but barang.read → true
            expect(Permission.canAny(["inventory.barang.delete", "inventory.barang.read"])).toBe(true);
        });

        it("should return false if none match", () => {
            Auth.login("operator");
            // Both are at higher levels (admin/owner) — not inherited by operator
            expect(Permission.canAny(["inventory.barang.delete", "inventory.supplier.create"])).toBe(false);
        });

    });


    describe("canAll()", () => {

        it("should return true if all match", () => {
            Auth.login("admin"); // role = owner (wildcard)
            expect(Permission.canAll(["inventory.dashboard.view", "inventory.barang.read"])).toBe(true);
        });

        it("should return false if not all match", () => {
            Auth.login("operator");
            // barang.read → true (from supervisor level), barang.delete → false (owner level)
            expect(Permission.canAll(["inventory.barang.read", "inventory.barang.delete"])).toBe(false);
        });

    });


    describe("currentRole()", () => {

        it("should return null when not logged in", () => {
            expect(Permission.currentRole()).toBeNull();
        });

        it("should return role for logged-in user", () => {
            Auth.login("admin");
            const role = Permission.currentRole();
            expect(role).not.toBeNull();
            expect(role.name).toBe("Owner");
        });

    });


    describe("role()", () => {

        it("should return role definition by name", () => {
            const role = Permission.role("admin");
            expect(role.name).toBe("Admin");
            expect(role.level).toBe(70);
        });

    });


    describe("roles()", () => {

        it("should return all roles from dynamic data", () => {
            const roles = Permission.roles();
            // 5 roles in testRoleData
            expect(Object.keys(roles).length).toBe(5);
            expect(roles).toHaveProperty("supervisor");
            expect(roles).toHaveProperty("operator");
            expect(roles).toHaveProperty("admin");
            expect(roles).toHaveProperty("owner");
            expect(roles).toHaveProperty("superadmin");
        });

    });


    describe("menu()", () => {

        it("should return empty array when not logged in", () => {
            expect(Permission.menu()).toEqual([]);
        });

        it("should return effective permissions for operator", () => {
            Auth.login("operator");
            const menu = Permission.menu();
            // Operator inherits:
            //   supervisor level: dashboard.view, barang.read, supplier.read, pembelian.read, report.view
            //   operator level:   barang.create, pembelian.create, stock.adjust
            expect(menu).toContain("inventory.dashboard.view");
            expect(menu).toContain("inventory.barang.read");
            expect(menu).toContain("inventory.barang.create");
            expect(menu).toContain("inventory.pembelian.read");
            // Should not include higher-level permissions
            expect(menu).not.toContain("inventory.barang.delete");
        });

    });


    describe("grant()", () => {

        it("should dynamically add permission to a role", () => {
            Auth.login("operator");
            expect(Permission.can("inventory.supplier.create")).toBe(false);
            Permission.grant("operator", "inventory.supplier.create");
            expect(Permission.can("inventory.supplier.create")).toBe(true);
        });

    });


    describe("revoke()", () => {

        it("should dynamically remove permission from a role", () => {
            Auth.login("operator");
            // barang.read comes from supervisor level inheritance
            expect(Permission.can("inventory.barang.read")).toBe(true);
            // Revoke from the source role (supervisor)
            Permission.revoke("supervisor", "inventory.barang.read");
            expect(Permission.can("inventory.barang.read")).toBe(false);
        });

    });


    describe("setOverride()", () => {

        it("should override permissions", () => {
            Permission.setOverride(["admin.access", "system.manage"]);
            expect(Permission.can("admin.access")).toBe(true);
            expect(Permission.can("system.manage")).toBe(true);
            expect(Permission.can("barang.view")).toBe(false);
        });

        it("should clear override with null and fall back to dynamic", () => {
            Permission.setOverride(["admin.access"]);
            Permission.setOverride(null);
            Auth.login("admin"); // role = owner, has ["*"] in dynamic data
            expect(Permission.can("admin.access")).toBe(true);
            expect(Permission.can("inventory.dashboard.view")).toBe(true);
        });

    });


    describe("onChange()", () => {

        it("should notify subscribers on grant", () => {
            let called = false;
            const unsub = Permission.onChange(() => { called = true; });
            Permission.grant("supervisor", "test.perm");
            expect(called).toBe(true);
            unsub();
        });

        it("should notify subscribers on revoke", () => {
            let called = false;
            const unsub = Permission.onChange(() => { called = true; });
            Permission.revoke("supervisor", "inventory.dashboard.view");
            expect(called).toBe(true);
            unsub();
        });

        it("should return unsubscribe function", () => {
            let called = 0;
            const unsub = Permission.onChange(() => { called++; });
            Permission.setOverride(["test"]);
            expect(called).toBe(1);
            unsub();
            Permission.setOverride(null);
            expect(called).toBe(1);
        });

    });

});
