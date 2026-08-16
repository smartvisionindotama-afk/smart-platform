/**
 * Unit tests — skuPrice (M6.2-FIX): harga efektif SKU varian marketplace.
 *
 * Harga per SKU dibagi 2: `harga` utk pelanggan UMUM, `harga_khusus` utk
 * MEMBER/pelanggan terdaftar (dipakai bila > 0). Pola sama dgn effectivePrice
 * produk (harga_jual vs harga_khusus), tapi diterapkan per kombinasi SKU.
 *
 * @module __tests__/kasir-sku-price
 */

import { describe, it, expect } from "vitest";
import { skuPrice } from "../../src/pages/pos/index.js";

describe("skuPrice — harga SKU varian utk umum vs member (M6.2-FIX)", () => {
    it("pelanggan umum → harga biasa (harga_khusus diabaikan)", () => {
        expect(skuPrice({ harga: 50000, harga_khusus: 45000 }, false)).toBe(50000);
        expect(skuPrice({ harga: 0, harga_khusus: 0 }, false)).toBe(0);
        expect(skuPrice({ harga: 12000 }, false)).toBe(12000);
    });

    it("member → harga khusus bila terisi (> 0)", () => {
        expect(skuPrice({ harga: 50000, harga_khusus: 45000 }, true)).toBe(45000);
        expect(skuPrice({ harga: 8000, harga_khusus: 7500 }, true)).toBe(7500);
    });

    it("member tanpa harga khusus (0/kosong) → fallback harga biasa", () => {
        expect(skuPrice({ harga: 50000, harga_khusus: 0 }, true)).toBe(50000);
        expect(skuPrice({ harga: 50000 }, true)).toBe(50000);
        expect(skuPrice({ harga: 0, harga_khusus: 0 }, true)).toBe(0);
    });

    it("default isMember mengikuti tipe pelanggan aktif (default umum)", () => {
        // state.tipePelanggan default = "umum" → harga biasa
        expect(skuPrice({ harga: 20000, harga_khusus: 18000 })).toBe(20000);
    });
});
