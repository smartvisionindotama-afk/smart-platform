/**
 * SP-029 M6 — Unit tests: billing-core (pure functions).
 * Mengikuti pola test existing (tanpa DB).
 */
import { describe, it, expect } from "vitest";
import {
    canTransition,
    calculateInvoiceTotal,
    buildInvoiceNumber,
    addMonth,
    periodKey,
    formatIDR,
    resolveFeaturePrice,
    buildCompanyItems,
    addBillingCycle
} from "../billing/billing-core.js";
import { nextSequence, syncCounterFromExisting } from "../billing/counter.js";
import { normalizeFeaturePrice } from "../routes/features.js";

describe("billing-core: state machine subscription", () => {
    it("TRIAL → ACTIVE valid", () => {
        expect(canTransition("TRIAL", "ACTIVE").ok).toBe(true);
    });
    it("TRIAL → EXPIRED valid", () => {
        expect(canTransition("TRIAL", "EXPIRED").ok).toBe(true);
    });
    it("ACTIVE → PAST_DUE valid", () => {
        expect(canTransition("ACTIVE", "PAST_DUE").ok).toBe(true);
    });
    it("ACTIVE → TRIAL tidak valid", () => {
        expect(canTransition("ACTIVE", "TRIAL").ok).toBe(false);
    });
    it("CANCELLED → ACTIVE tidak valid (terminal)", () => {
        expect(canTransition("CANCELLED", "ACTIVE").ok).toBe(false);
    });
    it("EXPIRED → ACTIVE tidak valid (terminal)", () => {
        expect(canTransition("EXPIRED", "ACTIVE").ok).toBe(false);
    });
    it("status sama → tidak valid", () => {
        expect(canTransition("ACTIVE", "ACTIVE").ok).toBe(false);
    });
    it("status tidak dikenal → tidak valid", () => {
        expect(canTransition("FOO", "ACTIVE").ok).toBe(false);
    });
});

describe("billing-core: invoice calculation (integer, server-side)", () => {
    it("subtotal tanpa addon/discount/tax", () => {
        const r = calculateInvoiceTotal({ subtotal: 199000 });
        expect(r).toEqual({ subtotal: 199000, addons: 0, discount: 0, taxableBase: 199000, tax: 0, total: 199000 });
    });
    it("subtotal + addon", () => {
        const r = calculateInvoiceTotal({ subtotal: 199000, addons: 50000 });
        expect(r.total).toBe(249000);
    });
    it("subtotal + addon − discount", () => {
        const r = calculateInvoiceTotal({ subtotal: 199000, addons: 50000, discount: 25000 });
        expect(r.taxableBase).toBe(224000);
        expect(r.total).toBe(224000);
    });
    it("tax 11% dibulatkan trunc", () => {
        const r = calculateInvoiceTotal({ subtotal: 199000, taxRate: 11 });
        expect(r.tax).toBe(21890); // trunc(199000*11/100) = 21890
        expect(r.total).toBe(220890);
    });
    it("discount melebihi subtotal → base 0", () => {
        const r = calculateInvoiceTotal({ subtotal: 1000, discount: 5000 });
        expect(r.taxableBase).toBe(0);
        expect(r.total).toBe(0);
    });
    it("angka desimal di-trunc ke integer (anti float)", () => {
        const r = calculateInvoiceTotal({ subtotal: 199000.99 });
        expect(r.subtotal).toBe(199000);
        expect(Number.isInteger(r.total)).toBe(true);
    });
    it("taxRate negatif di-clamp ke 0", () => {
        const r = calculateInvoiceTotal({ subtotal: 100000, taxRate: -5 });
        expect(r.tax).toBe(0);
    });
});

describe("billing-core: invoice number reproducible", () => {
    it("format INV/YYYY/MM/seq 6 digit", () => {
        const num = buildInvoiceNumber(123, new Date("2026-08-15"));
        expect(num).toBe("INV/2026/08/000123");
    });
    it("bulan 1 digit → padStart", () => {
        const num = buildInvoiceNumber(7, new Date("2026-01-01"));
        expect(num).toBe("INV/2026/01/000007");
    });
});

describe("billing counter: nextSequence (atomic)", () => {
    it("increment berurutan 1,2,3", async () => {
        let seq = 0;
        const col = {
            async findOneAndUpdate(filter, update, opts) {
                seq = (seq || 0) + 1;
                return { value: { seq } };
            }
        };
        expect(await nextSequence("invoice:2026-08", col)).toBe(1);
        expect(await nextSequence("invoice:2026-08", col)).toBe(2);
        expect(await nextSequence("invoice:2026-08", col)).toBe(3);
    });
    it("fallback ke 1 jika value tidak ada", async () => {
        const col = { async findOneAndUpdate() { return { value: null }; } };
        expect(await nextSequence("invoice:2026-08", col)).toBe(1);
    });
});

describe("billing counter: syncCounterFromExisting (anti tabrakan)", () => {
    it("counter existing > 0 → pertahankan tanpa sync", async () => {
        const col = {
            async findOne() { return { _id: "invoice:2026-08", seq: 42 }; },
            async updateOne() { throw new Error("tidak boleh dipanggil"); }
        };
        const seq = await syncCounterFromExisting("invoice:2026-08", "INV/2026/08/", { col });
        expect(seq).toBe(42);
    });
    it("counter kosong + invoice existing → init dari max seq", async () => {
        const col = {
            async findOne() { return null; },
            async updateOne(filter, update, opts) {
                expect(update.$setOnInsert.seq).toBe(7);
                return { ok: 1 };
            }
        };
        const findLast = async () => "INV/2026/08/000007";
        const seq = await syncCounterFromExisting("invoice:2026-08", "INV/2026/08/", { col, findLast });
        expect(seq).toBe(7);
    });
    it("counter kosong + tidak ada invoice → init 0", async () => {
        const col = {
            async findOne() { return null; },
            async updateOne(filter, update, opts) {
                expect(update.$setOnInsert.seq).toBe(0);
                return { ok: 1 };
            }
        };
        const findLast = async () => null;
        const seq = await syncCounterFromExisting("invoice:2026-08", "INV/2026/08/", { col, findLast });
        expect(seq).toBe(0);
    });
});

describe("billing-core: harga per fitur (M6-FIX override ?? katalog)", () => {
    it("tanpa override → pakai harga katalog", () => {
        expect(resolveFeaturePrice({}, { price: 150000 })).toBe(150000);
    });
    it("override perusahaan menang atas katalog", () => {
        expect(resolveFeaturePrice({ price: 200000 }, { price: 150000 })).toBe(200000);
    });
    it("override 0 (gratis) menang atas katalog", () => {
        expect(resolveFeaturePrice({ price: 0 }, { price: 150000 })).toBe(0);
    });
    it("harga negatif/desimal di-trunc & di-clamp ke 0", () => {
        expect(resolveFeaturePrice({ price: -5 }, {})).toBe(0);
        expect(resolveFeaturePrice({ price: 100.9 }, {})).toBe(100);
    });
    it("tidak ada harga sama sekali → 0 (tidak ditagih)", () => {
        expect(resolveFeaturePrice({}, {})).toBe(0);
    });
});

describe("billing-core: buildCompanyItems (invoice per fitur)", () => {
    const features = [
        { slug: "inventory", name: "SMART Inventory", price: 100000 },
        { slug: "pos", name: "SMART Kasir", price: 75000 }
    ];
    it("fitur enabled dengan harga → item feature", () => {
        const items = buildCompanyItems([
            { featureSlug: "inventory", featureId: "a", enabled: true },
            { featureSlug: "pos", featureId: "b", enabled: true }
        ], features);
        expect(items.length).toBe(2);
        expect(items[0]).toMatchObject({ kind: "feature", label: "SMART Inventory", amount: 100000, quantity: 1 });
        expect(items[1].amount).toBe(75000);
    });
    it("fitur disabled → tidak ditagih", () => {
        const items = buildCompanyItems([
            { featureSlug: "inventory", featureId: "a", enabled: false },
            { featureSlug: "pos", featureId: "b", enabled: true }
        ], features);
        expect(items.length).toBe(1);
        expect(items[0].refId).toBe("b");
    });
    it("fitur gratis (harga 0) → tidak ditagih", () => {
        const items = buildCompanyItems([
            { featureSlug: "inventory", featureId: "a", enabled: true, price: 0 }
        ], features);
        expect(items.length).toBe(0);
    });
    it("override harga per perusahaan dipakai", () => {
        const items = buildCompanyItems([
            { featureSlug: "inventory", featureId: "a", enabled: true, price: 250000 }
        ], features);
        expect(items[0].amount).toBe(250000);
    });
    it("subtotal = jumlah seluruh item", () => {
        const items = buildCompanyItems([
            { featureSlug: "inventory", featureId: "a", enabled: true, price: 250000 },
            { featureSlug: "pos", featureId: "b", enabled: true }
        ], features);
        const subtotal = items.reduce((s, it) => s + it.amount, 0);
        expect(subtotal).toBe(325000);
    });
});

describe("billing-core: addBillingCycle (renew sumber tunggal)", () => {
    it("MONTHLY = kalender +1 bulan", () => {
        const d = addBillingCycle(new Date("2026-08-15"), "MONTHLY");
        expect(d.getUTCMonth()).toBe(8); // September
        expect(d.getUTCFullYear()).toBe(2026);
    });
    it("MONTHLY wrap tahun", () => {
        const d = addBillingCycle(new Date("2026-12-01"), "MONTHLY");
        expect(d.getUTCFullYear()).toBe(2027);
        expect(d.getUTCMonth()).toBe(0);
    });
    it("YEARLY = +1 tahun", () => {
        const d = addBillingCycle(new Date("2026-08-15"), "YEARLY");
        expect(d.getUTCFullYear()).toBe(2027);
        expect(d.getUTCMonth()).toBe(7);
    });
    it("default cycle MONTHLY", () => {
        const d = addBillingCycle(new Date("2026-08-15"));
        expect(d.getUTCMonth()).toBe(8);
    });
});

describe("features: harga katalog (normalizeFeaturePrice)", () => {
    it("undefined/null/'' → 0", () => {
        expect(normalizeFeaturePrice(undefined)).toBe(0);
        expect(normalizeFeaturePrice(null)).toBe(0);
        expect(normalizeFeaturePrice("")).toBe(0);
    });
    it("integer positif dipertahankan", () => {
        expect(normalizeFeaturePrice(150000)).toBe(150000);
        expect(normalizeFeaturePrice("75000")).toBe(75000);
    });
    it("desimal di-trunc (anti float)", () => {
        expect(normalizeFeaturePrice(100.99)).toBe(100);
    });
    it("negatif/NaN → 0", () => {
        expect(normalizeFeaturePrice(-5)).toBe(0);
        expect(normalizeFeaturePrice("abc")).toBe(0);
    });
});

describe("billing-core: period & date helpers", () => {
    it("addMonth menambah 1 bulan", () => {
        const d = addMonth(new Date("2026-08-01"));
        expect(d.getUTCMonth()).toBe(8); // September (0-based)
        expect(d.getUTCFullYear()).toBe(2026);
    });
    it("addMonth wrap ke tahun berikutnya", () => {
        const d = addMonth(new Date("2026-12-15"));
        expect(d.getUTCFullYear()).toBe(2027);
        expect(d.getUTCMonth()).toBe(0);
    });
    it("periodKey YYYY-MM", () => {
        expect(periodKey(new Date("2026-08-08"))).toBe("2026-08");
    });
    it("formatIDR integer minor units", () => {
        expect(formatIDR(199000)).toBe("Rp199.000");
        expect(formatIDR(0)).toBe("Rp0");
    });
});
