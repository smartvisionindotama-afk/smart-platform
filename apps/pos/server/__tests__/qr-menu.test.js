import { describe, it, expect } from "vitest";
import {
    generateToken,
    formatOrderId,
    resolveItemHarga,
    resolveOrderItems,
    nextOrderNumber
} from "../services/qr-menu.js";

/**
 * F&B Customer Ordering V1 — QR Menu / Table Order (pure helpers).
 * Server-side pricing + token + nomor order sequential.
 */

describe("generateToken", () => {
    it("menghasilkan token URL-safe unik (base64url)", () => {
        const a = generateToken();
        const b = generateToken();
        expect(a).not.toEqual(b);
        expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(a.length).toBeGreaterThanOrEqual(10);
    });

    it("mendukung panjang entropi berbeda", () => {
        const short = generateToken(4);
        expect(short).toMatch(/^[A-Za-z0-9_-]+$/);
    });
});

describe("formatOrderId", () => {
    it("format ORDER #000125 (padding 6 digit)", () => {
        expect(formatOrderId(125)).toBe("ORDER #000125");
        expect(formatOrderId(1)).toBe("ORDER #000001");
        expect(formatOrderId(100000)).toBe("ORDER #100000");
    });
});

describe("resolveItemHarga — server-side pricing", () => {
    const produk = { _id: "p1", harga_jual: 10000, skus: [{ kode: "SKU-S", harga: 12000 }, { kode: "SKU-M", harga: 15000 }] };

    it("tanpa varian/SKU → harga_jual produk", () => {
        expect(resolveItemHarga(produk)).toBe(10000);
        expect(resolveItemHarga(produk, null, "")).toBe(10000);
    });

    it("harga_jual 0 → 0 (bukan negative)", () => {
        expect(resolveItemHarga({ harga_jual: 0 }, null, "")).toBe(0);
    });

    it("recipe dengan harga > 0 dipakai (fallback harga produk bila 0)", () => {
        expect(resolveItemHarga(produk, { harga: 14000 })).toBe(14000);
        expect(resolveItemHarga(produk, { harga: 0 })).toBe(10000);
    });

    it("SKU terpilih memakai harga SKU (pelanggan umum — bukan harga_khusus)", () => {
        expect(resolveItemHarga(produk, null, "SKU-M")).toBe(15000);
        expect(resolveItemHarga(produk, { harga: 14000 }, "SKU-S")).toBe(12000);
    });

    it("SKU tidak ditemukan → fallback harga produk", () => {
        expect(resolveItemHarga(produk, null, "SKU-XX")).toBe(10000);
    });
});

describe("resolveOrderItems — validasi + harga dari MASTER", () => {
    const pTrading = { _id: "p1", kode: "B1", nama: "Nasi Goreng", harga_jual: 25000 };
    const pVarian = { _id: "p2", kode: "B2", nama: "Kopi Susu", harga_jual: 10000 };
    const pSku = { _id: "p3", kode: "B3", nama: "Keripik", harga_jual: 5000, skus: [{ kode: "SKU-S", label: "S", harga: 6000 }] };
    const productMap = new Map([
        ["p1", pTrading], ["p2", pVarian], ["p3", pSku]
    ]);
    const recipeMap = new Map([["r1", { _id: "r1", name: "Pake Gula", harga: 12000 }]]);

    it("item valid → harga & subtotal dihitung server", () => {
        const check = resolveOrderItems([
            { productId: "p1", qty: 2 },
            { productId: "p2", qty: 1, recipeId: "r1" },
            { productId: "p3", qty: 3, skuKode: "SKU-S" }
        ], productMap, recipeMap);
        expect(check.ok).toBe(true);
        expect(check.items).toHaveLength(3);
        expect(check.items[0]).toMatchObject({ kode: "B1", harga: 25000, qty: 2, subtotal: 50000 });
        expect(check.items[1]).toMatchObject({ nama: "Kopi Susu (Pake Gula)", harga: 12000, qty: 1, subtotal: 12000 });
        // SKU varian (trading/service/resep simple) juga tampil di nama —
        // pola sama dengan resep F&B (struk/kitchen menampilkan `nama`).
        expect(check.items[2]).toMatchObject({ nama: "Keripik (S)", harga: 6000, qty: 3, subtotal: 18000 });
        expect(check.subtotal).toBe(80000);
    });

    it("items kosong → ditolak", () => {
        expect(resolveOrderItems([], productMap, recipeMap).ok).toBe(false);
        expect(resolveOrderItems(undefined, productMap, recipeMap).ok).toBe(false);
    });

    it("produk tidak ditemukan → ditolak (bukan harga 0)", () => {
        const check = resolveOrderItems([{ productId: "zzz", qty: 1 }], productMap, recipeMap);
        expect(check.ok).toBe(false);
        expect(check.error).toContain("tidak ditemukan");
    });

    it("qty tidak valid (0 / negatif / bukan angka / desimal) → ditolak", () => {
        expect(resolveOrderItems([{ productId: "p1", qty: 0 }], productMap, recipeMap).ok).toBe(false);
        expect(resolveOrderItems([{ productId: "p1", qty: -1 }], productMap, recipeMap).ok).toBe(false);
        expect(resolveOrderItems([{ productId: "p1", qty: "abc" }], productMap, recipeMap).ok).toBe(false);
        expect(resolveOrderItems([{ productId: "p1", qty: 1.5 }], productMap, recipeMap).ok).toBe(false);
    });

    it("qty melebihi batas (999) → ditolak", () => {
        expect(resolveOrderItems([{ productId: "p1", qty: 1000 }], productMap, recipeMap).ok).toBe(false);
    });

    it("recipeId tidak ditemukan → ditolak (tidak diam-diam pakai default)", () => {
        const check = resolveOrderItems([{ productId: "p2", qty: 1, recipeId: "nope" }], productMap, recipeMap);
        expect(check.ok).toBe(false);
        expect(check.error).toContain("Varian");
    });

    it("skuKode tidak terdaftar → ditolak", () => {
        const check = resolveOrderItems([{ productId: "p3", qty: 1, skuKode: "SKU-XX" }], productMap, recipeMap);
        expect(check.ok).toBe(false);
        expect(check.error).toContain("SKU");
    });

    it("catatan item dibatasi 200 karakter", () => {
        const check = resolveOrderItems([{ productId: "p1", qty: 1, catatan: "x".repeat(500) }], productMap, recipeMap);
        expect(check.ok).toBe(true);
        expect(check.items[0].catatan).toHaveLength(200);
    });
});

describe("nextOrderNumber — sequential per company", () => {
    it("tanpa order sebelumnya → 1", async () => {
        const n = await nextOrderNumber(async () => null, "PT-001");
        expect(n).toBe(1);
    });

    it("order terakhir 125 → 126", async () => {
        const n = await nextOrderNumber(async () => 125, "PT-001");
        expect(n).toBe(126);
    });
});
