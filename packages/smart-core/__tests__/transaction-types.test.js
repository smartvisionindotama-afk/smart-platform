import { describe, it, expect } from "vitest";
import {
    TRANSACTION_TYPES,
    TRANSACTION_TYPE_KEYS,
    DEFAULT_TRANSACTION_TYPES,
    isKnownTransactionType,
    getTransactionTypeMeta,
    normalizeTransactionTypes,
    validateTransactionTypes,
    isTransactionTypeEnabled,
    filterMenusByTransactionTypes
} from "../src/transaction-types/transaction-types.js";

/**
 * SP-029 POS V1 — Transaction Capability Foundation.
 * Registry capability jenis transaksi (single source of truth).
 */

describe("TRANSACTION_TYPES — registry capability tersedia (V1)", () => {
    it("berisi 7 capability V1 (retail, fnb, service, ppob, preorder, reservation, membership)", () => {
        const keys = TRANSACTION_TYPES.map(t => t.key);
        for (const k of ["retail", "fnb", "service", "ppob", "preorder", "reservation", "membership"]) {
            expect(keys).toContain(k);
        }
    });

    it("setiap capability memiliki key, label, dan description", () => {
        for (const t of TRANSACTION_TYPES) {
            expect(typeof t.key).toBe("string");
            expect(t.key.length).toBeGreaterThan(0);
            expect(typeof t.label).toBe("string");
            expect(t.label.length).toBeGreaterThan(0);
            expect(typeof t.description).toBe("string");
        }
    });

    it("tidak ada duplikat key", () => {
        expect(new Set(TRANSACTION_TYPES.map(t => t.key)).size).toBe(TRANSACTION_TYPES.length);
    });

    it("TRANSACTION_TYPE_KEYS sinkron dengan TRANSACTION_TYPES", () => {
        expect(TRANSACTION_TYPE_KEYS).toEqual(new Set(TRANSACTION_TYPES.map(t => t.key)));
    });

    it("DEFAULT_TRANSACTION_TYPES V1 = ['retail'] (backward compatible perilaku POS saat ini)", () => {
        expect(DEFAULT_TRANSACTION_TYPES).toEqual(["retail"]);
    });
});

describe("isKnownTransactionType / getTransactionTypeMeta — capability key valid", () => {
    it("key terdaftar → true, meta lengkap", () => {
        expect(isKnownTransactionType("retail")).toBe(true);
        expect(isKnownTransactionType("fnb")).toBe(true);
        expect(getTransactionTypeMeta("fnb").label).toBe("F&B");
        expect(getTransactionTypeMeta("retail").description.length).toBeGreaterThan(0);
    });

    it("key tak dikenal / non-string → false / null", () => {
        expect(isKnownTransactionType("galaksi")).toBe(false);
        expect(isKnownTransactionType("")).toBe(false);
        expect(isKnownTransactionType(42)).toBe(false);
        expect(isKnownTransactionType(undefined)).toBe(false);
        expect(getTransactionTypeMeta("galaksi")).toBe(null);
    });
});

describe("validateTransactionTypes — validasi ketat untuk penyimpanan", () => {
    it("capability unknown ditolak", () => {
        const r = validateTransactionTypes(["retail", "galaksi"]);
        expect(r.ok).toBe(false);
        expect(r.error).toContain("galaksi");
    });

    it("capability duplikat ditolak", () => {
        const r = validateTransactionTypes(["retail", "retail"]);
        expect(r.ok).toBe(false);
        expect(r.error).toContain("retail");
    });

    it("array kosong diperbolehkan (bisnis valid)", () => {
        expect(validateTransactionTypes([])).toEqual({ ok: true, value: [] });
    });

    it("daftar valid diterima & dinormalisasi (dedupe)", () => {
        expect(validateTransactionTypes(["retail", "fnb"])).toEqual({ ok: true, value: ["retail", "fnb"] });
    });

    it("non-array ditolak", () => {
        expect(validateTransactionTypes("retail").ok).toBe(false);
        expect(validateTransactionTypes(null).ok).toBe(false);
        expect(validateTransactionTypes(undefined).ok).toBe(false);
        expect(validateTransactionTypes({}).ok).toBe(false);
    });

    it("entry non-string ditolak", () => {
        const r = validateTransactionTypes(["retail", 42]);
        expect(r.ok).toBe(false);
    });
});

describe("normalizeTransactionTypes — normalisasi toleran untuk pembacaan", () => {
    it("non-array → []", () => {
        expect(normalizeTransactionTypes(undefined)).toEqual([]);
        expect(normalizeTransactionTypes(null)).toEqual([]);
        expect(normalizeTransactionTypes("retail")).toEqual([]);
    });

    it("capability unknown dibuang (tidak throw)", () => {
        expect(normalizeTransactionTypes(["retail", "galaksi", "fnb"])).toEqual(["retail", "fnb"]);
    });

    it("duplikat dihapus, urutan dipertahankan", () => {
        expect(normalizeTransactionTypes(["fnb", "retail", "fnb"])).toEqual(["fnb", "retail"]);
    });
});

describe("isTransactionTypeEnabled — enabled/disabled", () => {
    it("retail enabled → retail tersedia", () => {
        expect(isTransactionTypeEnabled(["retail"], "retail")).toBe(true);
        expect(isTransactionTypeEnabled(["retail", "fnb"], "retail")).toBe(true);
    });

    it("fnb enabled → fnb tersedia", () => {
        expect(isTransactionTypeEnabled(["retail", "fnb"], "fnb")).toBe(true);
    });

    it("fnb disabled → fnb tidak tersedia", () => {
        expect(isTransactionTypeEnabled(["retail"], "fnb")).toBe(false);
        expect(isTransactionTypeEnabled([], "fnb")).toBe(false);
    });

    it("fallback default V1 bila daftar tidak disediakan (company lama)", () => {
        expect(isTransactionTypeEnabled(undefined, "retail")).toBe(true);
        expect(isTransactionTypeEnabled(null, "retail")).toBe(true);
        expect(isTransactionTypeEnabled(undefined, "fnb")).toBe(false);
    });

    it("key tak dikenal selalu false", () => {
        expect(isTransactionTypeEnabled(["retail"], "galaksi")).toBe(false);
    });
});

describe("filterMenusByTransactionTypes — filter menu/route (pure)", () => {
    const menus = [
        { title: "Dashboard", page: "dashboard" },
        { title: "Kasir", page: "pos", capability: "retail" },
        {
            title: "Transaksi",
            children: [
                { title: "Retail", page: "sales", capability: "retail" },
                { title: "F&B", page: "fnb", capability: "fnb" }
            ]
        },
        {
            title: "Retail Only",
            children: [
                { title: "Kasir Retail", page: "retail-kasir", capability: "retail" }
            ]
        },
        { title: "Laporan", page: "report" }
    ];

    it("retail enabled → hanya menu retail yang tampil, F&B disembunyikan", () => {
        const result = filterMenusByTransactionTypes(menus, ["retail"]);
        expect(result.map(m => m.page).filter(Boolean)).toEqual(["dashboard", "pos", "report"]);
        const transaksi = result.find(m => m.title === "Transaksi");
        expect(transaksi.children.map(c => c.page)).toEqual(["sales"]);
    });

    it("retail + fnb enabled → keduanya tampil", () => {
        const result = filterMenusByTransactionTypes(menus, ["retail", "fnb"]);
        const transaksi = result.find(m => m.title === "Transaksi");
        expect(transaksi.children.map(c => c.page)).toEqual(["sales", "fnb"]);
    });

    it("grup yang semua anaknya terhapus ikut dihapus", () => {
        const result = filterMenusByTransactionTypes(menus, ["fnb"]);
        // Grup "Retail Only" (semua anak retail) hilang; grup "Transaksi"
        // tetap karena masih punya anak F&B.
        expect(result.find(m => m.title === "Retail Only")).toBeUndefined();
        const transaksi = result.find(m => m.title === "Transaksi");
        expect(transaksi.children.map(c => c.page)).toEqual(["fnb"]);
        expect(result.map(m => m.page).filter(Boolean)).toEqual(["dashboard", "report"]);
    });

    it("item tanpa field capability selalu dipertahankan (netral)", () => {
        const result = filterMenusByTransactionTypes(menus, []);
        expect(result.map(m => m.page).filter(Boolean)).toEqual(["dashboard", "report"]);
        expect(result.find(m => m.title === "Transaksi")).toBeUndefined();
    });
});
