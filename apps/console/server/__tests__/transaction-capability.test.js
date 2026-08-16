import { describe, it, expect } from "vitest";
import { normalizeCompanyConfigFields } from "../config/business-types.js";
import { COMPANY_UPDATE_FIELDS } from "../routes/companies.js";
import {
    TRANSACTION_TYPES,
    DEFAULT_TRANSACTION_TYPES,
    validateTransactionTypes
} from "../../../../packages/smart-core/src/transaction-types/transaction-types.js";

/**
 * SP-029 POS V1 — Transaction Capability Foundation (Master Platform).
 * Konfigurasi transactionTypes pada dokumen Company (Console).
 */

describe("COMPANY_UPDATE_FIELDS — transactionTypes WAJIB ikut tersimpan saat PUT companies", () => {
    it("field transactionTypes ada di daftar field yang di-update PUT companies", () => {
        // Regression guard: tanpa ini, PUT /api/companies/:id sukses tapi nilai
        // transactionTypes kembali ke awal (pola bug live businessType dulu).
        expect(COMPANY_UPDATE_FIELDS).toContain("transactionTypes");
    });

    it("tidak ada duplikat field", () => {
        expect(new Set(COMPANY_UPDATE_FIELDS).size).toBe(COMPANY_UPDATE_FIELDS.length);
    });
});

describe("normalizeCompanyConfigFields — transactionTypes (SP-029 POS V1)", () => {
    it("daftar valid dipertahankan", () => {
        const out = normalizeCompanyConfigFields({ transactionTypes: ["retail", "fnb"] });
        expect(out.transactionTypes).toEqual(["retail", "fnb"]);
    });

    it("array kosong dipertahankan (bisnis valid)", () => {
        expect(normalizeCompanyConfigFields({ transactionTypes: [] }).transactionTypes).toEqual([]);
    });

    it("daftar tak valid (duplikat) dibiarkan apa adanya — route yang menolak 400", () => {
        // Duplikat/unknown TIDAK dibuang diam-diam di normalisasi: biarkan utuh
        // agar validasi ketat route companies POST/PUT bisa menolak (400).
        const out = normalizeCompanyConfigFields({ transactionTypes: ["retail", "retail"] });
        expect(out.transactionTypes).toEqual(["retail", "retail"]);
    });

    it("field lain tidak terganggu", () => {
        const out = normalizeCompanyConfigFields({ name: "PT A", code: "PT-001", transactionTypes: ["retail"] });
        expect(out.name).toBe("PT A");
        expect(out.code).toBe("PT-001");
    });
});

describe("validateTransactionTypes — validasi ketat (registry @smart/core, dipakai route POST/PUT)", () => {
    it("capability unknown ditolak", () => {
        const r = validateTransactionTypes(["retail", "galaksi"]);
        expect(r.ok).toBe(false);
        expect(r.error).toContain("galaksi");
    });

    it("capability duplikat ditolak", () => {
        expect(validateTransactionTypes(["fnb", "fnb"]).ok).toBe(false);
    });

    it("array kosong diperbolehkan", () => {
        expect(validateTransactionTypes([])).toEqual({ ok: true, value: [] });
    });

    it("daftar valid diterima", () => {
        expect(validateTransactionTypes(["retail", "fnb"]).value).toEqual(["retail", "fnb"]);
    });
});

describe("registry — available capabilities (katalog untuk checkbox Console)", () => {
    it("metadata lengkap (key, label, description) & tanpa duplikat", () => {
        expect(TRANSACTION_TYPES.length).toBeGreaterThanOrEqual(7);
        expect(new Set(TRANSACTION_TYPES.map(t => t.key)).size).toBe(TRANSACTION_TYPES.length);
        for (const t of TRANSACTION_TYPES) {
            expect(t.key && t.label && t.description).toBeTruthy();
        }
    });

    it("default V1 = ['retail'] — fallback company lama", () => {
        expect(DEFAULT_TRANSACTION_TYPES).toEqual(["retail"]);
    });
});
