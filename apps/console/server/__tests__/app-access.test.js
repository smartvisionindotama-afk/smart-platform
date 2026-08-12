import { describe, it, expect } from "vitest";
import { companyHasAppAccess } from "../routes/superadmins.js";
import { normalizeApps } from "../routes/companies.js";

/**
 * SP-027 PRE-M5 round 4 — regression test untuk gating impersonation.
 *
 * Bug lama: mapping company→aplikasi hanya ada di state in-memory browser
 * (@smart/core platform._companyApps) yang tidak pernah di-load dari server
 * dan hilang saat refresh → UI "Registered Apps" selalu kosong, tapi
 * POST /api/superadmins/impersonation-token TIDAK memvalidasi akses → Login
 * As tetap bisa masuk walau company belum terhubung ke aplikasi.
 *
 * Fix: Company.apps (server) jadi sumber kebenaran; impersonation-token
 * menolak (403) company yang belum terhubung. Helper murni di bawah di-test.
 */

describe("companyHasAppAccess — gate impersonasi (SP-027 PRE-M5)", () => {
    it("company terhubung ke aplikasi → true", () => {
        const company = { code: "PT-001", apps: ["inventory"] };
        expect(companyHasAppAccess(company, "inventory")).toBe(true);
    });

    it("company TIDAK terhubung → false (root cause bug lama)", () => {
        const company = { code: "PT-001", apps: [] };
        expect(companyHasAppAccess(company, "inventory")).toBe(false);
    });

    it("company tanpa field apps (data lama, undefined) → false — TIDAK otomatis diizinkan", () => {
        // Pola berbahaya lama: undefined seharusnya TIDAK dianggap punya akses.
        const company = { code: "PT-001" };
        expect(companyHasAppAccess(company, "inventory")).toBe(false);
    });

    it("company null/undefined → false (tidak throw)", () => {
        expect(companyHasAppAccess(null, "inventory")).toBe(false);
        expect(companyHasAppAccess(undefined, "inventory")).toBe(false);
    });

    it("appSlug kosong → false", () => {
        expect(companyHasAppAccess({ code: "PT-001", apps: ["inventory"] }, "")).toBe(false);
        expect(companyHasAppAccess({ code: "PT-001", apps: ["inventory"] }, null)).toBe(false);
    });

    it("terhubung ke aplikasi lain → false untuk inventory", () => {
        const company = { code: "PT-001", apps: ["accounting"] };
        expect(companyHasAppAccess(company, "inventory")).toBe(false);
    });
});

describe("normalizeApps — whitelist slug aplikasi (SP-027 PRE-M5)", () => {
    it("hanya menyimpan slug yang dikenal + menghapus duplikat", () => {
        expect(normalizeApps(["inventory", "inventory", "pos"])).toEqual(["inventory", "pos"]);
    });

    it("slug tak dikenal / garbage dibuang", () => {
        expect(normalizeApps(["inventory", "garbage", "../../../etc", 42])).toEqual(["inventory"]);
    });

    it("non-array / undefined / null → []", () => {
        expect(normalizeApps(undefined)).toEqual([]);
        expect(normalizeApps(null)).toEqual([]);
        expect(normalizeApps("inventory")).toEqual([]);
        expect(normalizeApps({})).toEqual([]);
    });

    it("input kosong → []", () => {
        expect(normalizeApps([])).toEqual([]);
    });
});
