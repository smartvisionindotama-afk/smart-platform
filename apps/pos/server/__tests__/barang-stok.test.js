import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * M6.2-FIX v0.43 — Barang Stok Helper (SKU-aware).
 * Decrement/reversal stok barang dengan dukungan SKU varian marketplace:
 * item ber-skuKode meng-update stok kombinasi spesifik + sinkron agregat;
 * item tanpa SKU memakai $inc stok utama (behavior lama).
 */

// ── Mock model (di-mock sebelum service di-import) ──
const mocks = {
    Barang: {
        findOne: vi.fn(),
        findByIdAndUpdate: vi.fn(),
        findOneAndUpdate: vi.fn()
    }
};

vi.mock("../models/Barang.js", () => ({ Barang: mocks.Barang }));

const { adjustBarangStok } = await import("../services/barang-stok.js");

beforeEach(() => {
    vi.clearAllMocks();
});

/** Chainable mock utk Barang.findOne(...).select().lean() */
function findOneChain(doc) {
    const chain = {
        select: vi.fn(() => chain),
        lean: vi.fn(() => Promise.resolve(doc))
    };
    return chain;
}

/** Set Barang.findOne utk resolve ke dokumen tertentu. */
function mockFindOneWith(doc) {
    mocks.Barang.findOne.mockImplementation(() => findOneChain(doc));
}

describe("adjustBarangStok — SKU-aware stock adjustment", () => {
    it("item tanpa skuKode → $inc stok utama (behavior lama)", async () => {
        mocks.Barang.findOneAndUpdate.mockResolvedValue({});
        const ok = await adjustBarangStok({ companyCode: "PT-001", item: { kode: "BRG-A", qty: 2 }, delta: -2 });
        expect(ok).toBe(true);
        expect(mocks.Barang.findOneAndUpdate).toHaveBeenCalledWith(
            { companyCode: "PT-001", kode: "BRG-A" },
            { $inc: { stok: -2 } }
        );
    });

    it("item ber-skuKode → update stok kombinasi spesifik + sinkron agregat", async () => {
        mockFindOneWith({
            _id: "b1",
            skus: [
                { kode: "BRG-A-S", label: "S", harga: 50, stok: 10 },
                { kode: "BRG-A-M", label: "M", harga: 55, stok: 5 }
            ],
            stok: 15
        });
        mocks.Barang.findByIdAndUpdate.mockResolvedValue({});
        const ok = await adjustBarangStok({
            companyCode: "PT-001",
            item: { kode: "BRG-A", qty: 3, skuKode: "BRG-A-S" },
            delta: -3
        });
        expect(ok).toBe(true);
        expect(mocks.Barang.findByIdAndUpdate).toHaveBeenCalledWith("b1", {
            $set: {
                skus: [
                    { kode: "BRG-A-S", label: "S", harga: 50, stok: 7 },
                    { kode: "BRG-A-M", label: "M", harga: 55, stok: 5 }
                ],
                stok: 12 // agregat = 7 + 5
            }
        });
        expect(mocks.Barang.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("reversal (delta positif) menambah stok kombinasi", async () => {
        mockFindOneWith({
            _id: "b1",
            skus: [
                { kode: "BRG-A-S", label: "S", harga: 50, stok: 7 },
                { kode: "BRG-A-M", label: "M", harga: 55, stok: 5 }
            ],
            stok: 12
        });
        mocks.Barang.findByIdAndUpdate.mockResolvedValue({});
        await adjustBarangStok({
            companyCode: "PT-001",
            item: { kode: "BRG-A", qty: 3, skuKode: "BRG-A-S" },
            delta: 3
        });
        expect(mocks.Barang.findByIdAndUpdate).toHaveBeenCalledWith("b1", {
            $set: {
                skus: [
                    { kode: "BRG-A-S", label: "S", harga: 50, stok: 10 },
                    { kode: "BRG-A-M", label: "M", harga: 55, stok: 5 }
                ],
                stok: 15
            }
        });
    });

    it("skuKode tidak ditemukan di skus → fallback $inc stok utama", async () => {
        mockFindOneWith({
            _id: "b1",
            skus: [{ kode: "BRG-A-M", label: "M", harga: 55, stok: 5 }],
            stok: 5
        });
        mocks.Barang.findOneAndUpdate.mockResolvedValue({});
        await adjustBarangStok({
            companyCode: "PT-001",
            item: { kode: "BRG-A", qty: 1, skuKode: "BRG-A-XL" },
            delta: -1
        });
        expect(mocks.Barang.findOneAndUpdate).toHaveBeenCalledWith(
            { companyCode: "PT-001", kode: "BRG-A" },
            { $inc: { stok: -1 } }
        );
    });

    it("qty <= 0 → tidak melakukan apa-apa", async () => {
        const ok = await adjustBarangStok({ companyCode: "PT-001", item: { kode: "BRG-A", qty: 0 }, delta: -1 });
        expect(ok).toBe(false);
        expect(mocks.Barang.findOneAndUpdate).not.toHaveBeenCalled();
    });
});
