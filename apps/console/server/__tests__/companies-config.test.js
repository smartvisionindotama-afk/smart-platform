import { describe, it, expect } from "vitest";
import {
    BUSINESS_TYPES,
    normalizeBusinessType,
    normalizeCompanyConfigFields
} from "../config/business-types.js";
import { COMPANY_UPDATE_FIELDS } from "../routes/companies.js";

/**
 * SP-029 M2 — Konfigurasi produk (POS) di Master Platform.
 * Katalog business type + normalisasi field konfigurasi (whitelist & clamp).
 */

describe("COMPANY_UPDATE_FIELDS — field konfigurasi produk WAJIB ikut tersimpan saat PUT (M2-FIX)", () => {
    it("semua field konfigurasi produk ada di daftar field yang di-update PUT companies", () => {
        // Regression guard: bug live pernah terjadi — server lama tanpa field
        // ini di fieldsToUpdate → PUT sukses tapi nilai kembali ke awal.
        for (const f of [
            "businessType", "lokasiMode", "jumlahGudang", "jumlahKasir",
            "lisensiStatus", "lisensiExpiresAt"
        ]) {
            expect(COMPANY_UPDATE_FIELDS).toContain(f);
        }
    });

    it("tidak ada duplikat field", () => {
        expect(new Set(COMPANY_UPDATE_FIELDS).size).toBe(COMPANY_UPDATE_FIELDS.length);
    });

    it("field dasar perusahaan tetap ada (regresi PUT)", () => {
        for (const f of ["code", "name", "apps", "logo", "active", "status"]) {
            expect(COMPANY_UPDATE_FIELDS).toContain(f);
        }
    });
});

describe("BUSINESS_TYPES — katalog jenis usaha (M2)", () => {
    it("berisi tipe usaha utama dari roadmap (Retail/Cafe/Restoran/Bakery/Pharmacy/distributor/manufaktur)", () => {
        for (const t of ["Retail", "Cafe", "Restoran", "Bakery", "Pharmacy", "Distributor", "Manufacturing"]) {
            expect(BUSINESS_TYPES).toContain(t);
        }
    });

    it("tidak berisi duplikat", () => {
        expect(new Set(BUSINESS_TYPES).size).toBe(BUSINESS_TYPES.length);
    });
});

describe("normalizeBusinessType — whitelist (M2)", () => {
    it("nilai katalog diterima", () => {
        expect(normalizeBusinessType("Cafe")).toBe("Cafe");
        expect(normalizeBusinessType("Retail")).toBe("Retail");
    });

    it("nilai tak dikenal → \"\" (dibuang)", () => {
        expect(normalizeBusinessType("Spaceship")).toBe("");
        expect(normalizeBusinessType(undefined)).toBe("");
        expect(normalizeBusinessType(null)).toBe("");
        expect(normalizeBusinessType(42)).toBe("");
    });
});

describe("normalizeCompanyConfigFields — normalisasi POST/PUT companies (M2)", () => {
    it("field valid dipertahankan", () => {
        const out = normalizeCompanyConfigFields({
            name: "PT Contoh",
            businessType: "Cafe",
            lokasiMode: "multi",
            jumlahGudang: 4,
            jumlahKasir: 6,
            lisensiStatus: "trial"
        });
        expect(out.businessType).toBe("Cafe");
        expect(out.lokasiMode).toBe("multi");
        expect(out.jumlahGudang).toBe(4);
        expect(out.jumlahKasir).toBe(6);
        expect(out.lisensiStatus).toBe("trial");
    });

    it("nilai invalid di-clamp ke default (angka < 1 → 1)", () => {
        const out = normalizeCompanyConfigFields({
            businessType: "UnknownBiz",
            lokasiMode: "galaxy",
            jumlahGudang: -3,
            jumlahKasir: "x",
            lisensiStatus: "expired!"
        });
        expect(out.businessType).toBe("");
        expect(out.lokasiMode).toBe("single");
        expect(out.jumlahGudang).toBe(1);
        expect(out.jumlahKasir).toBe(1);
        expect(out.lisensiStatus).toBe("active");
    });

    it("field lain tidak terganggu", () => {
        const out = normalizeCompanyConfigFields({ name: "PT A", code: "PT-001", apps: ["pos"] });
        expect(out.name).toBe("PT A");
        expect(out.code).toBe("PT-001");
        expect(out.apps).toEqual(["pos"]);
    });

    it("lisensiExpiresAt kosong → null", () => {
        expect(normalizeCompanyConfigFields({ lisensiExpiresAt: "" }).lisensiExpiresAt).toBe(null);
    });
});
