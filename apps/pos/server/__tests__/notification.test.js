import { describe, it, expect } from "vitest";
import {
    buildOrderItemsSummary,
    buildKitchenOrderNotification,
    buildPaymentProofNotification,
    buildOrderCancelledNotification
} from "../services/notification.js";

/**
 * Role-Based Notification Bell (F&B V1) — builder notifikasi (pure).
 * Role separation (§4): kitchen → order_new; cashier → payment_proof.
 */

const ORDER = {
    _id: "order-1",
    orderId: "ORDER #000125",
    orderNumber: 125,
    nomorMeja: "MEJA 07",
    paymentMethod: "qris",
    total: 55000,
    items: [
        { nama: "Nasi Goreng", qty: 2 },
        { nama: "Es Teh", qty: 2 }
    ]
};

describe("buildOrderItemsSummary — ringkasan item utk pesan notifikasi", () => {
    it("kosong / bukan array → string kosong", () => {
        expect(buildOrderItemsSummary()).toBe("");
        expect(buildOrderItemsSummary([])).toBe("");
        expect(buildOrderItemsSummary(null)).toBe("");
    });

    it("satu item → '2× Nasi Goreng'", () => {
        expect(buildOrderItemsSummary([{ nama: "Nasi Goreng", qty: 2 }])).toBe("2× Nasi Goreng");
    });

    it("beberapa item digabung koma", () => {
        expect(buildOrderItemsSummary(ORDER.items)).toBe("2× Nasi Goreng, 2× Es Teh");
    });

    it("lebih dari maks → potong + ' +N lagi'", () => {
        const items = [
            { nama: "A", qty: 1 },
            { nama: "B", qty: 1 },
            { nama: "C", qty: 1 },
            { nama: "D", qty: 1 },
            { nama: "E", qty: 1 }
        ];
        expect(buildOrderItemsSummary(items, 3)).toBe("1× A, 1× B, 1× C +2 lagi");
    });
});

describe("buildKitchenOrderNotification — order baru masuk (KITCHEN)", () => {
    it("targetRole kitchen + type order_new + title sesuai spek", () => {
        const n = buildKitchenOrderNotification(ORDER);
        expect(n.targetRole).toBe("kitchen");
        expect(n.type).toBe("order_new");
        expect(n.title).toBe("Order baru masuk");
    });

    it("message berisi orderId + nomor meja", () => {
        const n = buildKitchenOrderNotification(ORDER);
        expect(n.message).toContain("ORDER #000125");
        expect(n.message).toContain("MEJA 07");
    });

    it("payload berisi ringkasan + daftar item (detail [LIHAT ORDER])", () => {
        const n = buildKitchenOrderNotification(ORDER);
        expect(n.payload.itemsSummary).toBe("2× Nasi Goreng, 2× Es Teh");
        expect(n.payload.items).toEqual([
            { nama: "Nasi Goreng", qty: 2 },
            { nama: "Es Teh", qty: 2 }
        ]);
    });

    it("kitchen HANYA melihat item resep (kitchenItems) — barang dagangan diabaikan", () => {
        const mixed = {
            ...ORDER,
            items: [
                { nama: "Nasi Goreng", qty: 2 },
                { nama: "Aquaviva", qty: 3 },
                { nama: "Jasa Katering", qty: 1 }
            ],
            // kitchenItems = subset resep yang dikerjakan dapur
            kitchenItems: [{ nama: "Nasi Goreng", qty: 2 }]
        };
        const n = buildKitchenOrderNotification(mixed);
        expect(n.payload.itemsSummary).toBe("2× Nasi Goreng");
        expect(n.payload.items).toEqual([{ nama: "Nasi Goreng", qty: 2 }]);
    });
});

describe("buildPaymentProofNotification — bukti pembayaran (CASHIER)", () => {
    it("targetRole cashier + type payment_proof + title sesuai spek", () => {
        const n = buildPaymentProofNotification(ORDER);
        expect(n.targetRole).toBe("cashier");
        expect(n.type).toBe("payment_proof");
        expect(n.title).toBe("Pembayaran baru menunggu verifikasi");
    });

    it("message berisi orderId, meja, metode (uppercase) dan nominal", () => {
        const n = buildPaymentProofNotification(ORDER);
        expect(n.message).toContain("ORDER #000125");
        expect(n.message).toContain("MEJA 07");
        expect(n.message).toContain("QRIS");
        expect(n.message).toContain("55.000");
    });

    it("payload berisi paymentMethod + amount", () => {
        const n = buildPaymentProofNotification(ORDER);
        expect(n.payload).toEqual({ paymentMethod: "qris", amount: 55000 });
    });

    it("order kosong → tetap terbentuk aman (tidak throw)", () => {
        const n = buildPaymentProofNotification({});
        expect(n.targetRole).toBe("cashier");
        expect(n.message).toBeDefined();
    });
});

describe("buildOrderCancelledNotification — order dibatalkan (CASHIER)", () => {
    it("targetRole cashier + type order_cancelled", () => {
        const n = buildOrderCancelledNotification(ORDER);
        expect(n.targetRole).toBe("cashier");
        expect(n.type).toBe("order_cancelled");
    });

    it("order SUDAH LUNAS → PERLU REFUND (title + payload.needsRefund=true)", () => {
        const n = buildOrderCancelledNotification({ ...ORDER, paymentStatus: "paid" });
        expect(n.title).toContain("REFUND");
        expect(n.payload.needsRefund).toBe(true);
        expect(n.payload.total).toBe(55000);
        expect(n.message).toContain("55.000");
    });

    it("order BELUM lunas → info pembatalan biasa (tanpa refund)", () => {
        const n = buildOrderCancelledNotification({ ...ORDER, paymentStatus: "pending" });
        expect(n.title).not.toContain("REFUND");
        expect(n.payload.needsRefund).toBe(false);
        expect(n.message).toContain("tanpa refund");
    });

    it("PEMBATALAN PARSIAL: ringkasan item dibatalkan + refund parsial", () => {
        const partial = {
            ...ORDER,
            paymentStatus: "paid",
            refundAmount: 33300,
            items: [
                { nama: "Nasi Goreng", qty: 2, cancelled: true },
                { nama: "Es Teh", qty: 2, cancelled: false }
            ]
        };
        const n = buildOrderCancelledNotification(partial);
        expect(n.title).toContain("Item dibatalkan");
        expect(n.title).toContain("REFUND");
        expect(n.payload.partial).toBe(true);
        expect(n.message).toContain("2× Nasi Goreng");
        expect(n.message).toContain("33.300");
        expect(n.payload.cancelledItems).toEqual([{ nama: "Nasi Goreng", qty: 2 }]);
    });

    it("order kosong → tetap terbentuk aman (tidak throw)", () => {
        const n = buildOrderCancelledNotification({});
        expect(n.targetRole).toBe("cashier");
        expect(n.payload.needsRefund).toBe(false);
    });
});
