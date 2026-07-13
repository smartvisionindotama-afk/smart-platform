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
// ──────────────────────────────────────────────

describe("Roles", () => {

    afterEach(() => {
        restoreOriginalPermissions();
    });


    describe("getEffectivePermissions()", () => {

        it("should return viewer permissions for viewer role", () => {
            const perms = getEffectivePermissions("viewer");
            expect(perms).toContain("dashboard.view");
            expect(perms).toContain("barang.view");
            expect(perms).not.toContain("barang.create");
        });

        it("should include inherited permissions for operator", () => {
            const perms = getEffectivePermissions("operator");
            expect(perms).toContain("dashboard.view");
            expect(perms).toContain("barang.view");
            expect(perms).toContain("barang.create");
            expect(perms).not.toContain("barang.delete");
        });

        it("should include inherited permissions for manager", () => {
            const perms = getEffectivePermissions("manager");
            expect(perms).toContain("dashboard.view");
            expect(perms).toContain("barang.view");
            expect(perms).toContain("barang.create");
            expect(perms).toContain("barang.update");
            expect(perms).toContain("supplier.create");
        });

        it("should include all permissions for owner", () => {
            const perms = getEffectivePermissions("owner");
            expect(perms).toContain("dashboard.view");
            expect(perms).toContain("barang.view");
            expect(perms).toContain("barang.create");
            expect(perms).toContain("barang.update");
            expect(perms).toContain("barang.delete");
            expect(perms).toContain("setting.manage");
            expect(perms).toContain("*");
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
            const role = getRole("manager");
            expect(role).not.toBeNull();
            expect(role.name).toBe("Manager");
            expect(role.level).toBe(70);
        });

        it("should return null for unknown role", () => {
            expect(getRole("unknown")).toBeNull();
        });

    });


    describe("listRoles()", () => {

        it("should return all role definitions", () => {
            const roles = listRoles();
            expect(roles).toHaveProperty("viewer");
            expect(roles).toHaveProperty("operator");
            expect(roles).toHaveProperty("manager");
            expect(roles).toHaveProperty("owner");
        });

        it("should return a copy (not reference)", () => {
            const roles = listRoles();
            roles.viewer = null;
            const rolesAgain = listRoles();
            expect(rolesAgain.viewer).not.toBeNull();
        });

    });


    describe("grantPermission()", () => {

        it("should add permission to a role", () => {
            const result = grantPermission("viewer", "report.export");
            expect(result).toBe(true);
            const perms = getEffectivePermissions("viewer");
            expect(perms).toContain("report.export");
        });

        it("should not duplicate permissions", () => {
            grantPermission("viewer", "dashboard.view");
            const perms = getEffectivePermissions("viewer");
            const count = perms.filter(p => p === "dashboard.view").length;
            expect(count).toBe(1);
        });

        it("should return false for unknown role", () => {
            expect(grantPermission("unknown", "test")).toBe(false);
        });

    });


    describe("revokePermission()", () => {

        it("should remove permission from a role", () => {
            const result = revokePermission("viewer", "dashboard.view");
            expect(result).toBe(true);
            const perms = getEffectivePermissions("viewer");
            expect(perms).not.toContain("dashboard.view");
        });

        it("should return false for non-existent permission", () => {
            expect(revokePermission("viewer", "nonexistent")).toBe(false);
        });

        it("should return false for unknown role", () => {
            expect(revokePermission("unknown", "test")).toBe(false);
        });

    });

});


// ──────────────────────────────────────────────
// Permission Module: User-aware facade
// ──────────────────────────────────────────────

describe("Permission Module", () => {

    beforeEach(() => {
        Auth.logout();
        Permission.setOverride(null);
        restoreOriginalPermissions();
    });


    describe("can()", () => {

        it("should return false when not logged in", () => {
            expect(Permission.can("dashboard.view")).toBe(false);
        });

        it("should check permission for logged-in user", () => {
            Auth.login("admin");
            expect(Permission.can("dashboard.view")).toBe(true);
            expect(Permission.can("barang.view")).toBe(true);
            expect(Permission.can("barang.create")).toBe(true);
        });

        it("should check operator permissions", () => {
            Auth.login("operator");
            expect(Permission.can("dashboard.view")).toBe(true);
            expect(Permission.can("barang.view")).toBe(true);
            expect(Permission.can("barang.create")).toBe(true);
            expect(Permission.can("barang.delete")).toBe(false);
            expect(Permission.can("supplier.create")).toBe(false);
        });

    });


    describe("canAny()", () => {

        it("should return true if any permission matches", () => {
            Auth.login("operator");
            expect(Permission.canAny(["barang.delete", "barang.view"])).toBe(true);
        });

        it("should return false if none match", () => {
            Auth.login("operator");
            expect(Permission.canAny(["barang.delete", "supplier.create"])).toBe(false);
        });

    });


    describe("canAll()", () => {

        it("should return true if all match", () => {
            Auth.login("admin");
            expect(Permission.canAll(["dashboard.view", "barang.view"])).toBe(true);
        });

        it("should return false if not all match", () => {
            Auth.login("operator");
            expect(Permission.canAll(["barang.view", "barang.delete"])).toBe(false);
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
            const role = Permission.role("manager");
            expect(role.name).toBe("Manager");
            expect(role.level).toBe(70);
        });

    });


    describe("roles()", () => {

        it("should return all roles", () => {
            const roles = Permission.roles();
            expect(Object.keys(roles).length).toBe(4);
        });

    });


    describe("menu()", () => {

        it("should return empty array when not logged in", () => {
            expect(Permission.menu()).toEqual([]);
        });

        it("should return effective permissions for logged-in user", () => {
            Auth.login("operator");
            const menu = Permission.menu();
            expect(menu).toContain("dashboard.view");
            expect(menu).toContain("barang.view");
            expect(menu).toContain("barang.create");
            expect(menu).toContain("pembelian.view");
        });

    });


    describe("grant()", () => {

        it("should dynamically add permission to a role", () => {
            Auth.login("operator");
            expect(Permission.can("supplier.create")).toBe(false);
            Permission.grant("operator", "supplier.create");
            expect(Permission.can("supplier.create")).toBe(true);
        });

    });


    describe("revoke()", () => {

        it("should dynamically remove permission from a role", () => {
            Auth.login("operator");
            expect(Permission.can("barang.view")).toBe(true);
            Permission.revoke("viewer", "barang.view");
            expect(Permission.can("barang.view")).toBe(false);
        });

    });


    describe("setOverride()", () => {

        it("should override permissions", () => {
            Permission.setOverride(["admin.access", "system.manage"]);
            expect(Permission.can("admin.access")).toBe(true);
            expect(Permission.can("system.manage")).toBe(true);
            expect(Permission.can("barang.view")).toBe(false);
        });

        it("should clear override with null", () => {
            Permission.setOverride(["admin.access"]);
            Permission.setOverride(null);
            Auth.login("admin");
            // Admin (owner) has "*" wildcard, so "admin.access" IS accessible
            expect(Permission.can("admin.access")).toBe(true);
            // Normal role-based permissions should work
            expect(Permission.can("dashboard.view")).toBe(true);
        });

    });


    describe("onChange()", () => {

        it("should notify subscribers on grant", () => {
            let called = false;
            const unsub = Permission.onChange(() => { called = true; });
            Permission.grant("viewer", "test.perm");
            expect(called).toBe(true);
            unsub();
        });

        it("should notify subscribers on revoke", () => {
            let called = false;
            const unsub = Permission.onChange(() => { called = true; });
            Permission.revoke("viewer", "dashboard.view");
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
