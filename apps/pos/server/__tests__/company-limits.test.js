import { describe, it, expect } from "vitest";
import {
    checkGudangLimit,
    checkKasirLimit,
    canTransfer,
    singleLocationTransferMessage
} from "../services/company-limits.js";

/**
 * SP-029 M2-FIX — Enforcement konfigurasi produk dari Master Platform.
 * Kuota gudang/kasir + mode lokasi (single/multi) di-enforce di server.
 */

describe("checkGudangLimit — kuota gudang dari Master Platform (jumlahGudang)", () => {
    it("masih di bawah kuota → allowed + remaining", () => {
        const res = checkGudangLimit({ jumlahGudang: 1 }, 0);
        expect(res.allowed).toBe(true);
        expect(res.limit).toBe(1);
        expect(res.remaining).toBe(1);
    });

    it("kuota penuh → ditolak dengan pesan yang jelas (ringkas, tanpa arahan Master Platform)", () => {
        const res = checkGudangLimit({ jumlahGudang: 1 }, 1);
        expect(res.allowed).toBe(false);
        expect(res.limit).toBe(1);
        expect(res.current).toBe(1);
        expect(res.message).toContain("Kuota gudang tercapai (1/1).");
        expect(res.message).not.toContain("Master Platform");
    });

    it("multi gudang (jumlahGudang 3) → izinkan hingga 3", () => {
        expect(checkGudangLimit({ jumlahGudang: 3 }, 2).allowed).toBe(true);
        expect(checkGudangLimit({ jumlahGudang: 3 }, 3).allowed).toBe(false);
    });

    it("config kosong → default aman 1 gudang", () => {
        expect(checkGudangLimit({}, 0).allowed).toBe(true);
        expect(checkGudangLimit({}, 1).allowed).toBe(false);
        expect(checkGudangLimit(null, 0).limit).toBe(1);
    });

    it("nilai tidak valid di-clamp (negatif/string)", () => {
        expect(checkGudangLimit({ jumlahGudang: -5 }, 0).limit).toBe(1);
        expect(checkGudangLimit({ jumlahGudang: "abc" }, 0).limit).toBe(1);
        expect(checkGudangLimit({ jumlahGudang: "2" }, 1).allowed).toBe(true);
    });
});

describe("checkKasirLimit — kuota kasir dari Master Platform (jumlahKasir)", () => {
    it("masih di bawah kuota → allowed", () => {
        const res = checkKasirLimit({ jumlahKasir: 1 }, 0);
        expect(res.allowed).toBe(true);
        expect(res.remaining).toBe(1);
    });

    it("kuota penuh → ditolak dengan pesan yang jelas (ringkas, tanpa arahan Master Platform)", () => {
        const res = checkKasirLimit({ jumlahKasir: 1 }, 1);
        expect(res.allowed).toBe(false);
        expect(res.message).toContain("Kuota kasir tercapai (1/1).");
        expect(res.message).not.toContain("Master Platform");
    });

    it("config kosong → default aman 1 kasir", () => {
        expect(checkKasirLimit({}, 0).allowed).toBe(true);
        expect(checkKasirLimit({}, 1).allowed).toBe(false);
    });
});

describe("canTransfer — mode lokasi single/multi", () => {
    it("multi → transfer diizinkan", () => {
        expect(canTransfer("multi")).toBe(true);
    });

    it("single → transfer ditolak", () => {
        expect(canTransfer("single")).toBe(false);
    });

    it("default/undefined → single (tidak diizinkan)", () => {
        expect(canTransfer(undefined)).toBe(false);
        expect(canTransfer("")).toBe(false);
    });

    it("pesan standar ringkas (tanpa arahan Master Platform)", () => {
        expect(singleLocationTransferMessage()).toContain("Single Lokasi");
        expect(singleLocationTransferMessage()).toContain("tidak tersedia");
        expect(singleLocationTransferMessage()).not.toContain("Master Platform");
    });
});
