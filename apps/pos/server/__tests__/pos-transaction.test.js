/**
 * Unit tests — POS Transaction Helpers (SP-029 M3 + PRD V1).
 *
 * Memverifikasi logika behavior-aware stock:
 *   - trading      → ikut pengurangan stok
 *   - service      → TIDAK ikut pengurangan stok
 *   - recipe       → TIDAK ikut pengurangan stok (keputusan PO 2026-08-10)
 *   - manufactured → TIDAK ikut pengurangan stok (placeholder)
 *   - digital      → TIDAK ikut pengurangan stok (placeholder)
 *   - POS_TAX_RATE / calcPosTax → pajak 11%
 *   - normalizePosPayload → default pelanggan & nilai numerik aman
 *
 * @module __tests__/pos-transaction
 */

import { describe, it, expect } from "vitest";
import { splitPosItemsByBehavior, returStockItems, normalizePosPayload, POS_TAX_RATE, calcPosTax, checkHoldResumeTransition, resolvePosCreateFlags, normalizeTipePelanggan } from "../services/pos-transaction.js";

describe("splitPosItemsByBehavior", () => {
    const barangs = [
        { kode: "BRG-001", behavior: "trading" },
        { kode: "BRG-002", behavior: "service" },
        { kode: "BRG-003", behavior: "service" },
        { kode: "BRG-004", behavior: "recipe" },
        { kode: "BRG-005", behavior: "manufactured" },
        { kode: "BRG-006", behavior: "digital" }
    ];

    it("memisahkan item trading dan service", () => {
        const items = [
            { kode: "BRG-001", qty: 2 },
            { kode: "BRG-002", qty: 1 },
            { kode: "BRG-003", qty: 5 }
        ];
        const { trading, service, noStock } = splitPosItemsByBehavior(items, barangs);
        expect(trading.map(i => i.kode)).toEqual(["BRG-001"]);
        expect(service.map(i => i.kode)).toEqual(["BRG-002", "BRG-003"]);
        expect(noStock.map(i => i.kode)).toEqual(["BRG-002", "BRG-003"]);
    });

    it("item recipe/manufactured/digital TIDAK mengurangi stok (keputusan PO)", () => {
        const items = [
            { kode: "BRG-001", qty: 1 },
            { kode: "BRG-004", qty: 2 },
            { kode: "BRG-005", qty: 3 },
            { kode: "BRG-006", qty: 4 }
        ];
        const { trading, noStock } = splitPosItemsByBehavior(items, barangs);
        expect(trading.map(i => i.kode)).toEqual(["BRG-001"]);
        expect(noStock.map(i => i.kode)).toEqual(["BRG-004", "BRG-005", "BRG-006"]);
    });

    it("item tanpa behavior (legacy) diperlakukan sebagai trading", () => {
        const { trading } = splitPosItemsByBehavior(
            [{ kode: "BRG-999", qty: 1 }],
            [{ kode: "BRG-999" }]
        );
        expect(trading.length).toBe(1);
    });

    it("barang kosong / tidak ditemukan → semua dianggap trading", () => {
        const { trading, service } = splitPosItemsByBehavior(
            [{ kode: "BRG-001", qty: 1 }, { kode: "BRG-002", qty: 2 }],
            []
        );
        expect(trading.length).toBe(2);
        expect(service.length).toBe(0);
    });
});

describe("returStockItems (PRD V1 §7.8 — behavior-aware retur)", () => {
    const barangs = [
        { kode: "BRG-001", behavior: "trading" },
        { kode: "BRG-002", behavior: "service" },
        { kode: "BRG-004", behavior: "recipe" },
        { kode: "BRG-005", behavior: "manufactured" },
        { kode: "BRG-006", behavior: "digital" }
    ];

    it("hanya item trading yang dikembalikan ke stok", () => {
        const items = [
            { kode: "BRG-001", qty: 3 },
            { kode: "BRG-002", qty: 1 },
            { kode: "BRG-004", qty: 2 },
            { kode: "BRG-005", qty: 1 },
            { kode: "BRG-006", qty: 4 }
        ];
        const result = returStockItems(items, barangs);
        expect(result.map(i => i.kode)).toEqual(["BRG-001"]);
        expect(result[0].qty).toBe(3);
    });

    it("transaksi jasa murni → tidak ada item yang memengaruhi stok", () => {
        const result = returStockItems(
            [{ kode: "BRG-002", qty: 1 }],
            [{ kode: "BRG-002", behavior: "service" }]
        );
        expect(result.length).toBe(0);
    });

    it("barang tanpa behavior (legacy) dianggap trading saat retur", () => {
        const result = returStockItems(
            [{ kode: "BRG-999", qty: 2 }],
            [{ kode: "BRG-999" }]
        );
        expect(result.length).toBe(1);
        expect(result[0].kode).toBe("BRG-999");
    });

    it("data barang tidak tersedia → aman dianggap trading (backward-compat)", () => {
        const result = returStockItems([{ kode: "BRG-001", qty: 1 }], []);
        expect(result.length).toBe(1);
    });
});

describe("POS_TAX_RATE / calcPosTax", () => {
    it("tarif pajak POS = 11% (keputusan PO 2026-08-10)", () => {
        expect(POS_TAX_RATE).toBe(0.11);
    });

    it("menghitung pajak dengan pembulatan rupiah", () => {
        expect(calcPosTax(100000)).toBe(11000);
        expect(calcPosTax(1000)).toBe(110);
        expect(calcPosTax(0)).toBe(0);
        expect(calcPosTax(-50)).toBe(0);
    });
});

describe("normalizePosPayload", () => {
    it("memberi default pelanggan & kasir saat kosong", () => {
        const p = normalizePosPayload({});
        expect(p.pelanggan).toBe("UMUM");
        expect(p.pelangganNama).toBe("Pelanggan Umum");
        expect(p.kasir).toBe("Kasir");
        expect(p.pajak).toBe(0);
        expect(p.bayar).toBe(0);
    });

    it("menormalisasi angka negatif menjadi 0", () => {
        const p = normalizePosPayload({ bayar: -100, pajak: -5, kembalian: -3 });
        expect(p.bayar).toBe(0);
        expect(p.pajak).toBe(0);
        expect(p.kembalian).toBe(0);
    });

    it("mempertahankan nilai valid & trim string", () => {
        const p = normalizePosPayload({
            pelanggan: "  UMUM  ",
            pelangganNama: "Walk-in",
            kasir: "Budi",
            bayar: "50000",
            pajak: 4500,
            kembalian: 1200,
            diskon: 300
        });
        expect(p.pelanggan).toBe("UMUM");
        expect(p.pelangganNama).toBe("Walk-in");
        expect(p.kasir).toBe("Budi");
        expect(p.bayar).toBe(50000);
        expect(p.pajak).toBe(4500);
        expect(p.kembalian).toBe(1200);
        expect(p.diskon).toBe(300);
    });
});

describe("checkHoldResumeTransition (PRD V1 §7.5)", () => {
    it("hold hanya untuk transaksi berstatus order", () => {
        expect(checkHoldResumeTransition("order", "hold")).toEqual({ ok: true });
    });

    it("hold ditolak untuk paid/delivered/held/void", () => {
        for (const s of ["paid", "delivered", "invoiced", "held", "void"]) {
            const r = checkHoldResumeTransition(s, "hold");
            expect(r.ok).toBe(false);
            expect(r.message).toContain(s);
        }
    });

    it("resume hanya untuk transaksi berstatus held", () => {
        expect(checkHoldResumeTransition("held", "resume")).toEqual({ ok: true });
    });

    it("resume ditolak untuk selain held", () => {
        for (const s of ["order", "paid", "void", ""]) {
            const r = checkHoldResumeTransition(s, "resume");
            expect(r.ok).toBe(false);
            expect(r.message).toContain(s || "");
        }
    });

    it("aksi tidak dikenal ditolak", () => {
        const r = checkHoldResumeTransition("order", "hapus");
        expect(r.ok).toBe(false);
        expect(r.message).toContain("hapus");
    });
});

describe("resolvePosCreateFlags (PRD V1 §7.5 — hold draft vs penjualan lunas)", () => {
    it("transaksi kasir biasa (sumber=pos, tanpa hold) → wajib bayar + kurangi stok", () => {
        const f = resolvePosCreateFlags({ sumber: "pos", hold: false });
        expect(f.isPos).toBe(true);
        expect(f.isHold).toBe(false);
        expect(f.enforcePayment).toBe(true);
        expect(f.decrementStock).toBe(true);
    });

    it("hold draft (sumber=pos + hold:true) → TANPA bayar & TANPA kurangi stok", () => {
        const f = resolvePosCreateFlags({ sumber: "pos", hold: true });
        expect(f.isPos).toBe(true);
        expect(f.isHold).toBe(true);
        expect(f.enforcePayment).toBe(false);
        expect(f.decrementStock).toBe(false);
    });

    it("hold hanya berlaku untuk sumber=pos (SO biasa tidak terpengaruh)", () => {
        const f = resolvePosCreateFlags({ sumber: "so", hold: true });
        expect(f.isPos).toBe(false);
        expect(f.isHold).toBe(false);
        expect(f.enforcePayment).toBe(false);
        expect(f.decrementStock).toBe(false);
    });

    it("body kosong / hold bukan boolean true → aman default", () => {
        expect(resolvePosCreateFlags({}).isPos).toBe(false);
        expect(resolvePosCreateFlags({}).isHold).toBe(false);
        expect(resolvePosCreateFlags({ sumber: "pos", hold: "yes" }).isHold).toBe(false);
        expect(resolvePosCreateFlags(undefined).enforcePayment).toBe(false);
    });
});

describe("normalizeTipePelanggan (M3-FIX v19 — member vs pelanggan umum)", () => {
    it("default pelanggan umum saat kosong / tidak dikenal", () => {
        expect(normalizeTipePelanggan()).toBe("umum");
        expect(normalizeTipePelanggan(null)).toBe("umum");
        expect(normalizeTipePelanggan("vip")).toBe("umum");
    });

    it("hanya 'member' yang menghasilkan member (case-insensitive)", () => {
        expect(normalizeTipePelanggan("member")).toBe("member");
        expect(normalizeTipePelanggan("MEMBER")).toBe("member");
        expect(normalizeTipePelanggan("Member")).toBe("member");
    });

    it("nilai tidak valid dianggap umum (backward-compatible)", () => {
        expect(normalizeTipePelanggan("umum")).toBe("umum");
        expect(normalizeTipePelanggan(1)).toBe("umum");
        expect(normalizeTipePelanggan({})).toBe("umum");
    });
});
