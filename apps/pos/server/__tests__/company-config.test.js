import { describe, it, expect } from "vitest";
import {
    POS_APP_SLUG,
    companyHasAppAccess,
    normalizeCompanyConfig,
    filterMenusByLokasi
} from "../services/company-config.js";

/**
 * SP-029 M2 — Integrasi Master Platform (POS).
 * Gate login user (Company.apps) + konfigurasi produk dari Master Platform.
 */

describe("companyHasAppAccess — gate product activation POS (M2)", () => {
    it("company terhubung ke POS → true", () => {
        expect(companyHasAppAccess({ code: "PT-001", apps: ["inventory", "pos"] })).toBe(true);
    });

    it("company TIDAK terhubung ke POS → false", () => {
        expect(companyHasAppAccess({ code: "PT-001", apps: ["inventory"] })).toBe(false);
        expect(companyHasAppAccess({ code: "PT-001", apps: [] })).toBe(false);
    });

    it("company tanpa field apps (data lama) → false — TIDAK otomatis diizinkan", () => {
        expect(companyHasAppAccess({ code: "PT-001" })).toBe(false);
    });

    it("company null/undefined → false (tidak throw)", () => {
        expect(companyHasAppAccess(null)).toBe(false);
        expect(companyHasAppAccess(undefined)).toBe(false);
    });

    it("appSlug kustom (mis. \"inventory\") dihormati", () => {
        expect(companyHasAppAccess({ apps: ["inventory"] }, "inventory")).toBe(true);
        expect(companyHasAppAccess({ apps: ["pos"] }, "inventory")).toBe(false);
    });

    it("POS_APP_SLUG = \"pos\"", () => {
        expect(POS_APP_SLUG).toBe("pos");
    });
});

describe("normalizeCompanyConfig — konfigurasi produk dari Master Platform (M2)", () => {
    it("default aman saat data kosong", () => {
        expect(normalizeCompanyConfig({})).toEqual({
            businessType: "",
            lokasiMode: "single",
            jumlahGudang: 1,
            jumlahKasir: 1,
            lisensiStatus: "active",
            lisensiExpiresAt: null
        });
    });

    it("nilai valid dipertahankan", () => {
        expect(normalizeCompanyConfig({
            businessType: "Cafe",
            lokasiMode: "multi",
            jumlahGudang: 3,
            jumlahKasir: 4,
            lisensiStatus: "trial",
            lisensiExpiresAt: "2026-12-31T00:00:00.000Z"
        })).toEqual({
            businessType: "Cafe",
            lokasiMode: "multi",
            jumlahGudang: 3,
            jumlahKasir: 4,
            lisensiStatus: "trial",
            lisensiExpiresAt: "2026-12-31T00:00:00.000Z"
        });
    });

    it("nilai tidak valid di-clamp (lokasiMode/lisensiStatus → default, angka < 1 → 1)", () => {
        const cfg = normalizeCompanyConfig({
            lokasiMode: "galaxy",
            lisensiStatus: "hacked",
            jumlahGudang: -5,
            jumlahKasir: "abc"
        });
        expect(cfg.lokasiMode).toBe("single");
        expect(cfg.lisensiStatus).toBe("active");
        expect(cfg.jumlahGudang).toBe(1);
        expect(cfg.jumlahKasir).toBe(1);
    });

    it("null → default aman (guard user tanpa companyCode)", () => {
        expect(normalizeCompanyConfig(null)).toEqual({
            businessType: "",
            lokasiMode: "single",
            jumlahGudang: 1,
            jumlahKasir: 1,
            lisensiStatus: "active",
            lisensiExpiresAt: null
        });
    });

    it("angka string diparse", () => {
        expect(normalizeCompanyConfig({ jumlahGudang: "5", jumlahKasir: "2" }).jumlahGudang).toBe(5);
        expect(normalizeCompanyConfig({ jumlahGudang: "5", jumlahKasir: "2" }).jumlahKasir).toBe(2);
    });
});

describe("filterMenusByLokasi — Single/Multi lokasi (M2)", () => {
    const menus = [
        { title: "Dashboard", page: "dashboard" },
        {
            title: "Transaksi",
            children: [
                { title: "Pembelian", page: "purchase" },
                { title: "Penjualan", page: "sales" },
                { title: "Transfer", page: "transfer" }
            ]
        },
        { title: "Laporan", page: "report" }
    ];

    it("single lokasi → Transfer Gudang disembunyikan + grup kosong dihapus", () => {
        const result = filterMenusByLokasi(menus, "single");
        const transaksi = result.find(m => m.title === "Transaksi");
        expect(transaksi).toBeDefined();
        expect(transaksi.children.map(c => c.page)).toEqual(["purchase", "sales"]);
        expect(result.map(m => m.page).filter(Boolean)).toEqual(["dashboard", "report"]);
    });

    it("multi lokasi → semua menu tetap tampil", () => {
        const result = filterMenusByLokasi(menus, "multi");
        const transaksi = result.find(m => m.title === "Transaksi");
        expect(transaksi.children.map(c => c.page)).toContain("transfer");
    });

    it("default (tanpa mode / undefined) → single", () => {
        const result = filterMenusByLokasi(menus, undefined);
        const transaksi = result.find(m => m.title === "Transaksi");
        expect(transaksi.children.map(c => c.page)).toEqual(["purchase", "sales"]);
    });
});
