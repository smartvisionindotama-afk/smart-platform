import { describe, it, expect, beforeEach } from "vitest";
import Institution from "../src/institution/institution.js";


describe("Institution (Enhanced)", () => {

    beforeEach(() => {
        Institution.set("inventory");
    });


    describe("current()", () => {

        it("should return current institution", () => {
            const inst = Institution.current();
            expect(inst).not.toBeNull();
            expect(inst.id).toBe("PT-001");
            expect(inst.name).toBe("SMART Inventory");
        });

        it("should return copies (not references)", () => {
            const inst1 = Institution.current();
            const inst2 = Institution.current();
            inst1.name = "Modified";
            expect(inst2.name).toBe("SMART Inventory");
        });

    });


    describe("set()", () => {

        it("should set active institution by key", () => {
            const result = Institution.set("company");
            expect(result).toBe(true);
            const inst = Institution.current();
            expect(inst.id).toBe("CMP001");
        });

        it("should return false for unknown institution", () => {
            const result = Institution.set("unknown");
            expect(result).toBe(false);
        });

        it("should not change current institution on failure", () => {
            Institution.set("unknown");
            const inst = Institution.current();
            expect(inst.id).toBe("PT-001");
        });

    });


    describe("list()", () => {

        it("should return all institutions", () => {
            const list = Institution.list();
            expect(list.length).toBe(3);
        });

        it("should return copies (not references)", () => {
            const list = Institution.list();
            list[0].name = "Modified";
            const listAgain = Institution.list();
            expect(listAgain[0].name).toBe("SMART Inventory");
        });

    });


    describe("byType()", () => {

        it("should filter institutions by type", () => {
            const list = Institution.byType("inventory");
            expect(list.length).toBe(1);
            expect(list[0].id).toBe("PT-001");
        });

        it("should return empty array for unknown type", () => {
            const list = Institution.byType("unknown");
            expect(list).toEqual([]);
        });

    });


    describe("exists()", () => {

        it("should return true for existing institution", () => {
            expect(Institution.exists("inventory")).toBe(true);
            expect(Institution.exists("company")).toBe(true);
        });

        it("should return false for non-existent institution", () => {
            expect(Institution.exists("unknown")).toBe(false);
        });

    });


    describe("get()", () => {

        it("should return institution by key", () => {
            const inst = Institution.get("company");
            expect(inst).not.toBeNull();
            expect(inst.name).toBe("PT Smart Vision Indotama");
        });

        it("should return null for unknown key", () => {
            expect(Institution.get("unknown")).toBeNull();
        });

        it("should return a copy", () => {
            const inst = Institution.get("inventory");
            inst.name = "Modified";
            const instAgain = Institution.get("inventory");
            expect(instAgain.name).toBe("SMART Inventory");
        });

    });


    describe("workspace()", () => {

        it("should return workspace of current institution", () => {
            Institution.set("inventory");
            expect(Institution.workspace()).toBe("warehouse");
        });

        it("should change workspace on institution switch", () => {
            Institution.set("company");
            expect(Institution.workspace()).toBe("corporate");
        });

    });


    describe("isType()", () => {

        it("should return true if current institution matches type", () => {
            Institution.set("inventory");
            expect(Institution.isType("inventory")).toBe(true);
        });

        it("should return false if not matching", () => {
            Institution.set("inventory");
            expect(Institution.isType("company")).toBe(false);
        });

    });


    describe("onChange()", () => {

        it("should notify on institution change", () => {
            let changed = false;
            const unsub = Institution.onChange(() => { changed = true; });
            Institution.set("company");
            expect(changed).toBe(true);
            unsub();
        });

    it("should pass current institution to subscriber", () => {
        let inst = null;
        const unsub = Institution.onChange((i) => { inst = i; });
        Institution.set("company");
        expect(inst).not.toBeNull();
        expect(inst.id).toBe("CMP001");
        unsub();
    });

        it("should not notify on failed set", () => {
            let count = 0;
            const unsub = Institution.onChange(() => { count++; });
            Institution.set("unknown");
            expect(count).toBe(0);
            unsub();
        });

        it("should return unsubscribe function", () => {
            let count = 0;
            const unsub = Institution.onChange(() => { count++; });
            Institution.set("company");
            expect(count).toBe(1);
            unsub();
            Institution.set("inventory");
            expect(count).toBe(1);
        });

    });

});
