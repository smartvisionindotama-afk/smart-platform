import { describe, it, expect } from "vitest";
import { cancelOrderItems } from "../services/order-cancel.js";

/**
 * F&B V1 — Pembatalan PER-ITEM oleh kitchen (pure service).
 * Kitchen membatalkan sebagian item (mis. 2 item dapur) — sisanya tetap
 * dibuat; refund dihitung PARSIAL (subtotal item + pajak proporsional).
 */

function makeOrder() {
    return {
        subtotal: 100000,
        pajak: 11000, // 11%
        items: [
            { itemId: "125-1", nama: "Nasi Goreng", qty: 2, subtotal: 50000 },
            { itemId: "125-2", nama: "Es Teh", qty: 2, subtotal: 20000 },
            { itemId: "125-3", nama: "Aqua", qty: 1, subtotal: 30000 }
        ],
        kitchenItems: [
            { itemId: "125-1", nama: "Nasi Goreng", qty: 2, subtotal: 50000 },
            { itemId: "125-2", nama: "Es Teh", qty: 2, subtotal: 20000 }
        ]
    };
}

describe("cancelOrderItems — pembatalan per-item", () => {
    it("menandai item terpilih (items + kitchenItems) + hitung nilai dibatalkan", () => {
        const order = makeOrder();
        const r = cancelOrderItems(order, ["125-1"], "Chef A", "bahan habis");
        expect(r.marked).toBe(1);
        expect(r.cancelledSubtotal).toBe(50000);
        // Refund parsial = subtotal item + pajak proporsional (11% dari 50rb)
        expect(r.refundAmount).toBe(55500);
        expect(r.allCancelled).toBe(false);
        expect(r.kitchenRemaining).toBe(1); // Es Teh masih di dapur
        // Baris di kedua array ditandai
        expect(order.items[0].cancelled).toBe(true);
        expect(order.kitchenItems[0].cancelled).toBe(true);
        expect(order.items[0].cancelledBy).toBe("Chef A");
        expect(order.items[1].cancelled).not.toBe(true);
    });

    it("beberapa item sekaligus → jumlah + refund gabungan", () => {
        const order = makeOrder();
        const r = cancelOrderItems(order, ["125-1", "125-2"], "Chef A");
        expect(r.marked).toBe(2);
        expect(r.cancelledSubtotal).toBe(70000);
        expect(r.refundAmount).toBe(77700); // 70rb + 11%
        expect(r.allCancelled).toBe(false); // Aqua (dagangan) masih ada
        expect(r.kitchenRemaining).toBe(0); // dapur selesai
    });

    it("SEMUA item dibatalkan → allCancelled=true", () => {
        const order = makeOrder();
        const r = cancelOrderItems(order, ["125-1", "125-2", "125-3"], "Chef A");
        expect(r.allCancelled).toBe(true);
        expect(r.cancelledSubtotal).toBe(100000);
        expect(r.refundAmount).toBe(111000); // total + pajak
    });

    it("item tanpa itemId TIDAK bisa dibatalkan per-item (kecuali forceAll)", () => {
        const order = makeOrder();
        order.items.push({ nama: "Legacy", qty: 1, subtotal: 10000 });
        const r = cancelOrderItems(order, ["125-1"], "Chef A");
        expect(r.marked).toBe(1);
        expect(order.items[3].cancelled).toBeUndefined();
        // forceAll → semua ditandai termasuk legacy
        const order2 = makeOrder();
        order2.items.push({ nama: "Legacy", qty: 1, subtotal: 10000 });
        const r2 = cancelOrderItems(order2, [], "Chef A", "", { forceAll: true });
        expect(r2.marked).toBe(4);
        expect(order2.items[3].cancelled).toBe(true);
    });

    it("item yang sudah dibatalkan tidak dihitung dua kali", () => {
        const order = makeOrder();
        cancelOrderItems(order, ["125-1"], "Chef A");
        const again = cancelOrderItems(order, ["125-1"], "Chef A");
        expect(again.marked).toBe(0);
        expect(again.cancelledSubtotal).toBe(0);
    });

    it("itemIds kosong / tidak cocok → marked 0", () => {
        const order = makeOrder();
        const r = cancelOrderItems(order, [], "Chef A");
        expect(r.marked).toBe(0);
        expect(r.cancelledSubtotal).toBe(0);
        const r2 = cancelOrderItems(order, ["tidak-ada"], "Chef A");
        expect(r2.marked).toBe(0);
    });

    it("tanpa pajak (rate 0) → refund = subtotal item", () => {
        const order = makeOrder();
        order.pajak = 0;
        const r = cancelOrderItems(order, ["125-2"], "Chef A");
        expect(r.refundAmount).toBe(20000);
    });
});
