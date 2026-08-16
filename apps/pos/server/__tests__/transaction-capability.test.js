import { describe, it, expect, vi } from "vitest";
import { normalizeCompanyConfig, isTransactionTypeEnabled as isCfgEnabled } from "../services/company-config.js";
import {
    checkTransactionTypeEnabled,
    parseTransactionCapabilitiesPayload,
    requireTransactionType
} from "../services/transaction-capability.js";
import { DEFAULT_TRANSACTION_TYPES } from "../../../../packages/smart-core/src/transaction-types/transaction-types.js";

/**
 * SP-029 POS V1 — Transaction Capability Foundation (SMART Kasir server).
 * Fallback company lama + enforcement backend (guard middleware).
 */

describe("normalizeCompanyConfig — transactionTypes (SP-029 POS V1)", () => {
    it("company lama TANPA field transactionTypes → fallback default V1 ([\"retail\"])", () => {
        const cfg = normalizeCompanyConfig({ code: "PT-001", lokasiMode: "single" });
        expect(cfg.transactionTypes).toEqual(["retail"]);
        // Perilaku POS saat ini (retail) tidak berubah
        expect(isCfgEnabled(cfg, "retail")).toBe(true);
        expect(isCfgEnabled(cfg, "fnb")).toBe(false);
    });

    it("default aman saat data kosong / null", () => {
        expect(normalizeCompanyConfig({}).transactionTypes).toEqual(["retail"]);
        expect(normalizeCompanyConfig(null).transactionTypes).toEqual(["retail"]);
    });

    it("daftar valid dipertahankan (retail + fnb)", () => {
        const cfg = normalizeCompanyConfig({ transactionTypes: ["retail", "fnb"] });
        expect(cfg.transactionTypes).toEqual(["retail", "fnb"]);
        expect(isCfgEnabled(cfg, "retail")).toBe(true);
        expect(isCfgEnabled(cfg, "fnb")).toBe(true);
    });

    it("array kosong yang tersimpan eksplisit dipertahankan (bisnis valid)", () => {
        const cfg = normalizeCompanyConfig({ transactionTypes: [] });
        expect(cfg.transactionTypes).toEqual([]);
        expect(isCfgEnabled(cfg, "retail")).toBe(false);
        expect(isCfgEnabled(cfg, "fnb")).toBe(false);
    });

    it("capability unknown dibuang pada pembacaan (toleran), retail tetap tersedia", () => {
        const cfg = normalizeCompanyConfig({ transactionTypes: ["retail", "galaksi"] });
        expect(cfg.transactionTypes).toEqual(["retail"]);
        expect(isCfgEnabled(cfg, "retail")).toBe(true);
    });

    it("duplikat dibersihkan pada pembacaan", () => {
        expect(normalizeCompanyConfig({ transactionTypes: ["fnb", "retail", "fnb"] }).transactionTypes).toEqual(["fnb", "retail"]);
    });
});

describe("checkTransactionTypeEnabled — helper murni", () => {
    it("retail enabled → tersedia; fnb disabled → tidak tersedia", () => {
        expect(checkTransactionTypeEnabled(["retail"], "retail")).toBe(true);
        expect(checkTransactionTypeEnabled(["retail"], "fnb")).toBe(false);
        expect(checkTransactionTypeEnabled(["retail", "fnb"], "fnb")).toBe(true);
    });

    it("fallback default V1 bila daftar tidak disediakan", () => {
        expect(checkTransactionTypeEnabled(undefined, "retail")).toBe(true);
        expect(checkTransactionTypeEnabled(null, "fnb")).toBe(false);
    });

    it("key tak dikenal → false", () => {
        expect(checkTransactionTypeEnabled(["retail"], "galaksi")).toBe(false);
    });
});

describe("requireTransactionType — enforcement backend (bukan hanya hide/show UI)", () => {
    // req/res stub minimal tanpa framework HTTP
    function mockRes() {
        const res = {};
        res.status = vi.fn().mockReturnValue(res);
        res.json = vi.fn().mockReturnValue(res);
        return res;
    }

    it("capability disabled → 403 + error jelas (disabled capability tidak dapat digunakan)", async () => {
        const guard = requireTransactionType("fnb", { getTypes: async () => ["retail"] });
        const req = { headers: { "x-company-code": "PT-001" } };
        const res = mockRes();
        const next = vi.fn();
        await guard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("F&B") }));
        expect(next).not.toHaveBeenCalled();
    });

    it("capability enabled → lanjut (next dipanggil)", async () => {
        const guard = requireTransactionType("retail", { getTypes: async () => ["retail"] });
        const req = { headers: { "x-company-code": "PT-001" } };
        const res = mockRes();
        const next = vi.fn();
        await guard(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    it("tanpa header company → 400 (scope tidak bisa ditentukan)", async () => {
        const guard = requireTransactionType("retail", { getTypes: async () => ["retail"] });
        const req = { headers: {} };
        const res = mockRes();
        const next = vi.fn();
        await guard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    it("fallback default V1: company lama (tanpa field) → retail tetap diizinkan", async () => {
        // getTypes mengembalikan default V1 (perilaku getCompanyTransactionTypes)
        const guard = requireTransactionType("retail", { getTypes: async () => [...DEFAULT_TRANSACTION_TYPES] });
        const req = { headers: { "x-company-code": "PT-LAMA" } };
        const res = mockRes();
        const next = vi.fn();
        await guard(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("error dari resolver diteruskan ke next (bukan 500 mentah)", async () => {
        const guard = requireTransactionType("retail", { getTypes: async () => { throw new Error("db down"); } });
        const req = { headers: { "x-company-code": "PT-001" } };
        const res = mockRes();
        const next = vi.fn();
        await guard(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
});

describe("parseTransactionCapabilitiesPayload — payload PUT M6.1", () => {
    it("bentuk kanonik array { transactionTypes: [...] } diterima", () => {
        expect(parseTransactionCapabilitiesPayload({ transactionTypes: ["retail", "fnb"] }))
            .toEqual({ ok: true, value: ["retail", "fnb"] });
    });

    it("bentuk M6 object boolean { retail: true, fnb: true, ... } → array", () => {
        expect(parseTransactionCapabilitiesPayload({ retail: true, fnb: true, service: false, ppob: false }))
            .toEqual({ ok: true, value: ["retail", "fnb"] });
    });

    it("bentuk object boolean semua false → array kosong (bisnis valid)", () => {
        expect(parseTransactionCapabilitiesPayload({ retail: false, fnb: false }))
            .toEqual({ ok: true, value: [] });
    });

    it("object kosong → array kosong", () => {
        expect(parseTransactionCapabilitiesPayload({})).toEqual({ ok: true, value: [] });
    });

    it("capability tidak dikenal ditolak (bentuk object boolean)", () => {
        const r = parseTransactionCapabilitiesPayload({ retail: true, galaksi: true });
        expect(r.ok).toBe(false);
        expect(r.error).toContain("galaksi");
    });

    it("nilai bukan boolean ditolak (bentuk object boolean)", () => {
        const r = parseTransactionCapabilitiesPayload({ retail: "yes" });
        expect(r.ok).toBe(false);
        expect(r.error).toContain("boolean");
    });

    it("array form unknown ditolak", () => {
        const r = parseTransactionCapabilitiesPayload({ transactionTypes: ["retail", "galaksi"] });
        expect(r.ok).toBe(false);
        expect(r.error).toContain("galaksi");
    });

    it("array form duplikat ditolak", () => {
        const r = parseTransactionCapabilitiesPayload({ transactionTypes: ["retail", "retail"] });
        expect(r.ok).toBe(false);
        expect(r.error).toContain("retail");
    });

    it("non-object ditolak dengan pesan jelas", () => {
        expect(parseTransactionCapabilitiesPayload(null).ok).toBe(false);
        expect(parseTransactionCapabilitiesPayload(undefined).ok).toBe(false);
        expect(parseTransactionCapabilitiesPayload("retail").ok).toBe(false);
        expect(parseTransactionCapabilitiesPayload(["retail"]).ok).toBe(false);
    });
});

describe("DEFAULT_TRANSACTION_TYPES — backward compatibility", () => {
    it("default V1 = ['retail'] sesuai perilaku POS saat ini", () => {
        expect(DEFAULT_TRANSACTION_TYPES).toEqual(["retail"]);
    });
});
