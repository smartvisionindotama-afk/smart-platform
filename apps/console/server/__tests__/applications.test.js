import { describe, it, expect } from "vitest";
import { normalizeSlug, validateApplicationPayload } from "../routes/applications.js";
import { normalizeApps } from "../routes/companies.js";

/**
 * SP-027 PRE-M5 round 5 — regression test untuk CRUD aplikasi platform.
 *
 * Sebelumnya daftar aplikasi hanya registry mock (APPS_REGISTRY client) —
 * tidak ada model MongoDB/API, dan perubahan hilang saat refresh. Kini
 * aplikasi adalah data server (Application collection); helper murni di
 * bawah di-test agar slug & payload valid dan Company.apps hanya menerima
 * slug yang terdaftar.
 */

describe("normalizeSlug — identitas aplikasi (SP-027 PRE-M5)", () => {
    it("lowercase + trim", () => {
        expect(normalizeSlug("  My App  ")).toBe("my-app");
        expect(normalizeSlug("INVENTORY")).toBe("inventory");
    });

    it("karakter tidak valid diganti tanda hubung, beruntun digabung", () => {
        expect(normalizeSlug("my app!!")).toBe("my-app");
        expect(normalizeSlug("a..b__c")).toBe("a-b-c");
        expect(normalizeSlug("  --x--  ")).toBe("x");
    });

    it("kosong/undefined → string kosong", () => {
        expect(normalizeSlug("")).toBe("");
        expect(normalizeSlug(undefined)).toBe("");
        expect(normalizeSlug(null)).toBe("");
    });
});

describe("validateApplicationPayload — payload CRUD (SP-027 PRE-M5)", () => {
    it("payload valid → tanpa error", () => {
        expect(validateApplicationPayload({ name: "Inventory", slug: "inventory" })).toEqual([]);
    });

    it("nama kosong → error", () => {
        expect(validateApplicationPayload({ name: "", slug: "inventory" })).not.toEqual([]);
        expect(validateApplicationPayload({ slug: "inventory" })).not.toEqual([]);
    });

    it("slug kosong → error", () => {
        expect(validateApplicationPayload({ name: "Inventory" })).not.toEqual([]);
    });

    it("slug format salah (spasi/karakter khusus) → error", () => {
        expect(validateApplicationPayload({ name: "X", slug: "my app" })).not.toEqual([]);
        expect(validateApplicationPayload({ name: "X", slug: "MyApp!" })).not.toEqual([]);
        expect(validateApplicationPayload({ name: "X", slug: "-leading" })).not.toEqual([]);
    });

    it("slug format benar (huruf kecil, angka, hubung) → valid", () => {
        expect(validateApplicationPayload({ name: "X", slug: "my-app-2" })).toEqual([]);
    });
});

describe("normalizeApps dengan knownSlugs dinamis (SP-027 PRE-M5 round 5)", () => {
    it("slug dari registry (mis. aplikasi baru 'smartwms') dipertahankan", () => {
        const known = new Set(["inventory", "smartwms"]);
        expect(normalizeApps(["inventory", "smartwms"], known)).toEqual(["inventory", "smartwms"]);
    });

    it("slug TIDAK terdaftar dibuang walau ada di fallback bawaan", () => {
        // Jika registry server tidak memuat 'pos' (mis. sudah dihapus), slug itu
        // harus ditolak — daftar knownSlugs adalah sumber kebenaran.
        const known = new Set(["inventory"]);
        expect(normalizeApps(["inventory", "pos"], known)).toEqual(["inventory"]);
    });

    it("tanpa knownSlugs → fallback bawaan dipakai (backward compat)", () => {
        expect(normalizeApps(["inventory", "pos", "garbage"])).toEqual(["inventory", "pos"]);
    });

    it("duplikat dihapus; non-array → []", () => {
        expect(normalizeApps(["inventory", "inventory"], new Set(["inventory"]))).toEqual(["inventory"]);
        expect(normalizeApps(undefined, new Set(["inventory"]))).toEqual([]);
        expect(normalizeApps("inventory", new Set(["inventory"]))).toEqual([]);
    });
});
