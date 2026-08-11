/**
 * pos-gudang Service — Unit Tests (M3-FIX v21).
 *
 * Gudang-Kasir: normalize payload admin & resolve gudang terhubung kasir.
 *
 * @module server/__tests__/pos-gudang
 */

import { describe, it, expect } from "vitest";
import { normalizeGudangPayload, resolveKasirGudang } from "../services/pos-gudang.js";

const WAREHOUSES = [
    { kode: "JWR-001", nama: "Gudang Utama" },
    { kode: "JWR-002", nama: "Store Keboharan" },
    { kode: "JWR-003", nama: "Cold Storage" }
];

describe("normalizeGudangPayload", () => {
    it("mengembalikan array kosong untuk payload kosong", () => {
        expect(normalizeGudangPayload({}, WAREHOUSES)).toEqual({ gudangTerkoneksi: [], gudangKasir: [] });
        expect(normalizeGudangPayload(null, WAREHOUSES)).toEqual({ gudangTerkoneksi: [], gudangKasir: [] });
    });

    it("membersihkan kode gudang tak dikenal dari gudangTerkoneksi", () => {
        const out = normalizeGudangPayload({ gudangTerkoneksi: ["JWR-001", "XXX-999", "JWR-003", "JWR-001"] }, WAREHOUSES);
        expect(out.gudangTerkoneksi).toEqual(["JWR-001", "JWR-003"]);
    });

    it("menyaring mapping kasir-gudang yang tidak valid + mengisi nama gudang dari server", () => {
        const out = normalizeGudangPayload({
            gudangKasir: [
                { kasir: "kasirA", kodeGudang: "JWR-001" },
                { kasir: "kasirB", kodeGudang: "XXX-999" },
                { kasir: "", kodeGudang: "JWR-002" }
            ]
        }, WAREHOUSES);
        expect(out.gudangKasir).toHaveLength(1);
        expect(out.gudangKasir[0]).toMatchObject({ kasir: "kasirA", kodeGudang: "JWR-001", namaGudang: "Gudang Utama" });
    });
});

describe("resolveKasirGudang", () => {
    it("null tanpa setting (default kompatibel — seluruh stok)", () => {
        expect(resolveKasirGudang({ setting: null, user: { username: "kasir" }, warehouses: WAREHOUSES })).toBeNull();
    });

    it("null tanpa setting.gudang* (belum dikonfigurasi)", () => {
        expect(resolveKasirGudang({ setting: {}, user: { username: "kasir" }, warehouses: WAREHOUSES })).toBeNull();
    });

    it("mapping per-kasir diprioritaskan di atas gudangTerkoneksi", () => {
        const out = resolveKasirGudang({
            setting: { gudangTerkoneksi: ["JWR-001"], gudangKasir: [{ kasir: "kasir", kodeGudang: "JWR-002" }] },
            user: { username: "kasir" },
            warehouses: WAREHOUSES
        });
        expect(out.kodeGudang).toBe("JWR-002");
        expect(out.namaGudang).toBe("Store Keboharan");
    });

    it("gudangTerkoneksi dipakai saat tanpa mapping kasir", () => {
        const out = resolveKasirGudang({
            setting: { gudangTerkoneksi: ["JWR-001", "JWR-003"], gudangKasir: [] },
            user: { username: "kasir" },
            warehouses: WAREHOUSES
        });
        expect(out.kodeGudang).toBe("JWR-001");
        expect(out.kodeList).toEqual(["JWR-001", "JWR-003"]);
    });

    it("gudangValues memuat kode + nama gudang + stok umum (\"\") untuk scoping Barang.gudang", () => {
        const out = resolveKasirGudang({
            setting: { gudangTerkoneksi: ["JWR-001"] },
            user: { username: "kasir" },
            warehouses: WAREHOUSES
        });
        expect(out.gudangValues).toEqual(expect.arrayContaining(["", "JWR-001", "Gudang Utama"]));
    });

    it("null bila semua kode tak dikenal", () => {
        expect(resolveKasirGudang({
            setting: { gudangTerkoneksi: ["XXX"] },
            user: { username: "kasir" },
            warehouses: WAREHOUSES
        })).toBeNull();
    });

    // M3-FIX v24 — mapping fleksibel: 1 gudang banyak kasir ATAU 1 kasir
    // banyak gudang (baris [gudang][kasir] — komposisi bisa berubah).
    it("kasir terhubung ke BANYAK gudang → union kodeList (mapping fleksibel)", () => {
        const out = resolveKasirGudang({
            setting: {
                gudangTerkoneksi: ["JWR-003"],
                gudangKasir: [
                    { kasir: "kasirA", kodeGudang: "JWR-001" },
                    { kasir: "kasirA", kodeGudang: "JWR-002" },
                    { kasir: "kasirB", kodeGudang: "JWR-002" }
                ]
            },
            user: { username: "kasirA" },
            warehouses: WAREHOUSES
        });
        expect(out.kodeGudang).toBe("JWR-001");
        expect([...out.kodeList].sort()).toEqual(["JWR-001", "JWR-002"]);
        expect(out.gudangValues).toEqual(expect.arrayContaining(["", "JWR-001", "Gudang Utama", "JWR-002", "Store Keboharan"]));
    });

    it("gudang yang sama dipakai banyak kasir → tiap kasir resolve gudangnya sendiri", () => {
        const setting = {
            gudangTerkoneksi: [],
            gudangKasir: [
                { kasir: "kasirC", kodeGudang: "JWR-002" },
                { kasir: "kasirD", kodeGudang: "JWR-002" },
                { kasir: "kasirE", kodeGudang: "JWR-002" },
                { kasir: "kasirA", kodeGudang: "JWR-001" }
            ]
        };
        const outC = resolveKasirGudang({ setting, user: { username: "kasirC" }, warehouses: WAREHOUSES });
        const outA = resolveKasirGudang({ setting, user: { username: "kasirA" }, warehouses: WAREHOUSES });
        expect(outC.kodeGudang).toBe("JWR-002");
        expect(outA.kodeGudang).toBe("JWR-001");
    });
});
