import { describe, it, expect } from "vitest";
import {
    normalizeWaNumber,
    normalizeMejaLabel,
    formatRupiah,
    buildWaCheckoutMessage,
    buildWaCheckoutUrl,
    waRestaurantNumber
} from "../../src/utils/whatsapp.js";

/**
 * F&B QR Menu V2 — WhatsApp Checkout (menu di web, checkout via WA).
 * Helpers PURE (tanpa DOM) — testable tanpa browser.
 */

describe("normalizeWaNumber — nomor HP → format internasional wa.me", () => {
    it("0812-3456-7890 → 6281234567890", () => {
        expect(normalizeWaNumber("0812-3456-7890")).toBe("6281234567890");
    });

    it("+62 812-3456-7890 → 6281234567890", () => {
        expect(normalizeWaNumber("+62 812-3456-7890")).toBe("6281234567890");
    });

    it("6281234567890 (sudah internasional) → tetap", () => {
        expect(normalizeWaNumber("6281234567890")).toBe("6281234567890");
    });

    it("81234567890 (tanpa 0/62) → 6281234567890", () => {
        expect(normalizeWaNumber("81234567890")).toBe("6281234567890");
    });

    it("kosong / hanya non-digit → \"\"", () => {
        expect(normalizeWaNumber("")).toBe("");
        expect(normalizeWaNumber(undefined)).toBe("");
        expect(normalizeWaNumber("abc-xyz")).toBe("");
        expect(normalizeWaNumber(null)).toBe("");
    });
});

describe("normalizeMejaLabel — hindari \"Meja: Meja 001\"", () => {
    it("nomorMeja sudah berisi kata Meja → hilangkan awalan", () => {
        expect(normalizeMejaLabel("Meja 001")).toBe("001");
        expect(normalizeMejaLabel("MEJA 001")).toBe("001");
        expect(normalizeMejaLabel("meja 001")).toBe("001");
    });

    it("tanpa awalan Meja → tetap", () => {
        expect(normalizeMejaLabel("001")).toBe("001");
        expect(normalizeMejaLabel(" 7 ")).toBe("7");
    });

    it("kosong → \"-\"", () => {
        expect(normalizeMejaLabel("")).toBe("-");
        expect(normalizeMejaLabel(undefined)).toBe("-");
    });
});

describe("buildWaCheckoutMessage — pesan order otomatis", () => {
    const items = [
        { nama: "Nasi Goreng", qty: 1, harga: 25000 },
        { nama: "Es Teh", qty: 2, harga: 7000 }
    ];

    it("berisi salam, meja, item, total & nama (tanpa \"Meja: Meja\")", () => {
        const msg = buildWaCheckoutMessage(
            { name: "Kafe ABC", whatsapp: "081234567890" },
            { nomorMeja: "Meja 05" },
            items,
            { taxEnabled: false, nama: "Budi", ref: "ORDER #000125" }
        );
        expect(msg).toContain("Halo, saya ingin memesan.");
        expect(msg).toContain("Meja: 05");
        expect(msg).not.toContain("Meja: Meja");
        expect(msg).toContain("Order: ORDER #000125");
        expect(msg).toContain("1x Nasi Goreng  Rp 25.000");
        expect(msg).toContain("2x Es Teh  Rp 14.000");
        expect(msg).toContain("Total  Rp 39.000");
        expect(msg).toContain("Nama: Budi");
    });

    it("taxEnabled → Subtotal + Pajak (11%) + Total", () => {
        const msg = buildWaCheckoutMessage({ whatsapp: "081234567890" }, { nomorMeja: "05" }, items, { taxEnabled: true });
        expect(msg).toContain("Subtotal  Rp 39.000");
        expect(msg).toContain("Pajak (11%)  Rp 4.290");
        expect(msg).toContain("Total  Rp 43.290");
    });

    it("tanpa nama → tanpa baris Nama", () => {
        const msg = buildWaCheckoutMessage({ whatsapp: "081234567890" }, { nomorMeja: "05" }, items, {});
        expect(msg).not.toContain("Nama:");
    });

    it("waPhone → pesan memuat baris No. WA", () => {
        const msg = buildWaCheckoutMessage(
            { whatsapp: "081234567890" },
            { nomorMeja: "05" },
            items,
            { nama: "Budi", waPhone: "0812-3456-7890" }
        );
        expect(msg).toContain("Nama: Budi");
        expect(msg).toContain("No. WA: 0812-3456-7890");
    });

    it("tanpa waPhone → tanpa baris No. WA", () => {
        const msg = buildWaCheckoutMessage({ whatsapp: "081234567890" }, { nomorMeja: "05" }, items, { nama: "Budi" });
        expect(msg).toContain("Nama: Budi");
        expect(msg).not.toContain("No. WA:");
    });

    it("item kosong → tetap terbentuk (Total Rp 0)", () => {
        const msg = buildWaCheckoutMessage({ whatsapp: "081234567890" }, { nomorMeja: "05" }, [], {});
        expect(msg).toContain("Total  Rp 0");
    });
});

describe("buildWaCheckoutUrl — wa.me nomor restoran, pesan ter-encode", () => {
    const items = [{ nama: "Nasi Goreng", qty: 1, harga: 25000 }];

    it("URL valid + pesan ter-encode berisi item & meja", () => {
        const url = buildWaCheckoutUrl(
            { name: "Kafe ABC", whatsapp: "0812-3456-7890" },
            { nomorMeja: "Meja 05" },
            items,
            { nama: "Budi", ref: "ORD-1" }
        );
        expect(url.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
        const text = decodeURIComponent(url.split("text=")[1]);
        expect(text).toContain("Meja: 05");
        expect(text).toContain("1x Nasi Goreng");
        expect(text).toContain("Total  Rp 25.000");
        expect(text).toContain("Nama: Budi");
        expect(text).not.toContain("##");
    });

    it("tanpa nomor WA → \"\" (checkout WA tidak tersedia)", () => {
        expect(buildWaCheckoutUrl({ name: "Kafe", whatsapp: "" }, { nomorMeja: "1" }, items, {})).toBe("");
        expect(buildWaCheckoutUrl({ name: "Kafe" }, { nomorMeja: "1" }, items, {})).toBe("");
        expect(buildWaCheckoutUrl({ name: "Kafe", whatsapp: "abc" }, { nomorMeja: "1" }, items, {})).toBe("");
    });
});

describe("waRestaurantNumber — prioritas Nomor Pengirim (Konfigurasi WA) di atas field lama", () => {
    it("waSenderNumber dipakai bila ada (menggantikan whatsapp)", () => {
        expect(waRestaurantNumber({ waSenderNumber: "081111111111", whatsapp: "081234567890" })).toBe("081111111111");
        const url = buildWaCheckoutUrl(
            { name: "Kafe", waSenderNumber: "081111111111", whatsapp: "081234567890" },
            { nomorMeja: "05" },
            [{ nama: "A", qty: 1, harga: 1000 }],
            {}
        );
        expect(url.startsWith("https://wa.me/6281111111111?text=")).toBe(true);
    });

    it("fallback ke whatsapp (data lama) bila waSenderNumber kosong", () => {
        expect(waRestaurantNumber({ waSenderNumber: "", whatsapp: "081234567890" })).toBe("081234567890");
        expect(waRestaurantNumber({ whatsapp: "081234567890" })).toBe("081234567890");
        expect(waRestaurantNumber({})).toBe("");
        expect(waRestaurantNumber(null)).toBe("");
    });
});

describe("formatRupiah", () => {
    it("format angka → Rp dengan pemisah ribuan", () => {
        expect(formatRupiah(25000)).toBe("Rp 25.000");
        expect(formatRupiah(0)).toBe("Rp 0");
        expect(formatRupiah(1234567)).toBe("Rp 1.234.567");
    });
});
