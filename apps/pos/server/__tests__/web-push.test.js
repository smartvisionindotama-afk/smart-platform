import { describe, it, expect } from "vitest";
import {
    buildReadyPayload,
    buildCancelledPayload,
    buildItemsCancelledPayload,
    buildRefundPayload,
    fitPushPayload,
    classifyPushError,
    PUSH_NOTIFICATION_ICON,
    PUSH_PAYLOAD_MAX_BYTES
} from "../services/web-push.js";

/**
 * F&B V1 — Web Push payload \"Pesanan siap\".
 * Payload murni (tanpa network) — testable tanpa memanggil push service.
 */

describe("buildReadyPayload", () => {
    it("payload berisi pesan sesuai spek + data order", () => {
        const order = {
            _id: "abc123",
            orderId: "ORDER #000125",
            orderNumber: 125,
            nomorMeja: "MEJA 07",
            qrIdentifier: "Ab7xK92p",
            orderToken: "tok123"
        };
        const payload = JSON.parse(buildReadyPayload(order, { name: "Kafe ABC" }));
        expect(payload.title).toContain("siap");
        expect(payload.body).toContain("MEJA 07");
        expect(payload.body).toContain("ORDER #000125");
        expect(payload.vibrate).toEqual([200, 100, 200]);
        expect(payload.data.orderId).toBe("abc123");
        expect(payload.data.url).toBe("/m/Ab7xK92p?order=tok123");
        // F&B V1 — pesan suara utk speechSynthesis di service worker
        expect(payload.speakText).toContain("siap");
    });

    it("icon/badge memakai ikon PWA statis — bukan logo data URI (payload < 4KB)", () => {
        // Logo company disimpan sebagai data URI base64 (puluhan KB) — bila
        // di-embed ke payload, Chrome/FCM menolak push (413) dan notifikasi
        // TIDAK pernah tampil saat browser ditutup. Builder harus memakai
        // ikon statis dan payload tetap di bawah batas.
        const bigLogo = "data:image/jpeg;base64," + "A".repeat(60000);
        const order = {
            _id: "abc123",
            orderId: "ORDER #000125",
            nomorMeja: "MEJA 07",
            qrIdentifier: "Ab7xK92p",
            orderToken: "tok123"
        };
        const payload = JSON.parse(buildReadyPayload(order, { name: "Kafe ABC", logo: bigLogo }));
        expect(payload.icon).toBe(PUSH_NOTIFICATION_ICON);
        expect(payload.badge).toBe(PUSH_NOTIFICATION_ICON);
        expect(payload.icon.startsWith("data:")).toBe(false);
        expect(Buffer.byteLength(JSON.stringify(payload), "utf-8")).toBeLessThanOrEqual(PUSH_PAYLOAD_MAX_BYTES);
    });

    it("SEMUA builder push memakai ikon statis + payload di bawah batas", () => {
        const bigLogo = "data:image/png;base64," + "B".repeat(40000);
        const order = {
            _id: "o1",
            orderId: "ORDER #1",
            nomorMeja: "MEJA 1",
            paymentStatus: "paid",
            refundAmount: 25000,
            items: [{ nama: "Nasi Goreng", qty: 2, cancelled: true }],
            qrIdentifier: "x",
            orderToken: "t"
        };
        for (const raw of [
            buildReadyPayload(order, { logo: bigLogo }),
            buildCancelledPayload(order, { logo: bigLogo }),
            buildItemsCancelledPayload(order, { logo: bigLogo }),
            buildRefundPayload(order, { logo: bigLogo })
        ]) {
            const p = JSON.parse(raw);
            expect(p.icon).toBe(PUSH_NOTIFICATION_ICON);
            expect(p.badge).toBe(PUSH_NOTIFICATION_ICON);
            expect(Buffer.byteLength(raw, "utf-8")).toBeLessThanOrEqual(PUSH_PAYLOAD_MAX_BYTES);
        }
    });

    it("speakText pembayaran approved vs rejected (buildPaymentPayload)", () => {
        const { buildPaymentPayload } = require("../services/web-push.js");
        const order = { _id: "1", orderId: "ORDER #1", nomorMeja: "MEJA 1", qrIdentifier: "x", orderToken: "t" };
        const approved = JSON.parse(buildPaymentPayload(order, null, "approved"));
        const rejected = JSON.parse(buildPaymentPayload(order, null, "rejected"));
        expect(approved.speakText).toContain("dikonfirmasi");
        expect(rejected.speakText).toContain("verifikasi");
    });

    it("deep-link kosong bila order tidak punya qrIdentifier", () => {
        const payload = JSON.parse(buildReadyPayload({ _id: "1", orderId: "ORDER #1", nomorMeja: "MEJA 1" }, null));
        expect(payload.data.url).toBe("");
    });

    it("fallback company kosong tidak error", () => {
        const payload = buildReadyPayload({ _id: "1", nomorMeja: "MEJA 01" });
        expect(typeof payload).toBe("string");
        expect(payload.length).toBeGreaterThan(0);
    });
});

describe("buildCancelledPayload — order dibatalkan (kitchen)", () => {
    const order = {
        _id: "abc123",
        orderId: "ORDER #000126",
        orderNumber: 126,
        nomorMeja: "MEJA 03",
        paymentStatus: "pending",
        qrIdentifier: "Ab7xK92p",
        orderToken: "tok123"
    };

    it("judul 'Pesanan Anda telah dibatalkan' + meja/order + deep-link", () => {
        const p = JSON.parse(buildCancelledPayload(order, { name: "Kafe" }));
        expect(p.title).toContain("dibatalkan");
        expect(p.body).toContain("MEJA 03");
        expect(p.body).toContain("ORDER #000126");
        expect(p.data.url).toBe("/m/Ab7xK92p?order=tok123");
        expect(p.speakText).toContain("dibatalkan");
    });

    it("order SUDAH LUNAS → body menyebut refund", () => {
        const p = JSON.parse(buildCancelledPayload({ ...order, paymentStatus: "paid" }, null));
        expect(p.body).toContain("refund");
    });

    it("order belum lunas → body tanpa klaim refund", () => {
        const p = JSON.parse(buildCancelledPayload(order, null));
        expect(p.body).not.toContain("refund");
    });
});

describe("buildItemsCancelledPayload — item dibatalkan per-item (kitchen)", () => {
    const order = {
        _id: "abc123",
        orderId: "ORDER #000126",
        nomorMeja: "MEJA 03",
        paymentStatus: "pending",
        items: [
            { nama: "Nasi Goreng", qty: 2, cancelled: true },
            { nama: "Es Teh", qty: 2, cancelled: false }
        ],
        qrIdentifier: "Ab7xK92p",
        orderToken: "tok123"
    };

    it("judul 'Beberapa item pesanan dibatalkan' + nama item + deep-link", () => {
        const p = JSON.parse(buildItemsCancelledPayload(order, null));
        expect(p.title).toContain("item pesanan dibatalkan");
        expect(p.body).toContain("2× Nasi Goreng");
        expect(p.body).toContain("MEJA 03");
        expect(p.data.url).toBe("/m/Ab7xK92p?order=tok123");
    });

    it("order LUNAS + refund parsial → body menyebut nominal refund", () => {
        const p = JSON.parse(buildItemsCancelledPayload({
            ...order,
            paymentStatus: "paid",
            refundAmount: 33300
        }, null));
        expect(p.body).toContain("33.300");
        expect(p.body).toContain("Refund");
    });

    it("order belum lunas → tanpa klaim refund", () => {
        const p = JSON.parse(buildItemsCancelledPayload(order, null));
        expect(p.body).not.toContain("refund");
    });
});

describe("buildRefundPayload — pembayaran direfund (kasir)", () => {
    it("judul refund + nominal + deep-link", () => {
        const order = {
            _id: "abc123",
            orderId: "ORDER #000126",
            nomorMeja: "MEJA 03",
            refundAmount: 55000,
            qrIdentifier: "Ab7xK92p",
            orderToken: "tok123"
        };
        const p = JSON.parse(buildRefundPayload(order, null));
        expect(p.title).toContain("refund");
        expect(p.body).toContain("55.000");
        expect(p.body).toContain("MEJA 03");
        expect(p.speakText).toContain("refund");
        expect(p.data.url).toBe("/m/Ab7xK92p?order=tok123");
    });

    it("tanpa refundAmount → fallback total order", () => {
        const p = JSON.parse(buildRefundPayload({ total: 75000, nomorMeja: "MEJA 1" }, null));
        expect(p.body).toContain("75.000");
    });
});

describe("fitPushPayload — jaring pengaman batas 4KB (Chrome/FCM)", () => {
    it("payload kecil tidak diubah", () => {
        const raw = JSON.stringify({ title: "x", icon: PUSH_NOTIFICATION_ICON, data: { url: "/m/x" } });
        const r = fitPushPayload(raw);
        expect(r.stripped).toBe(false);
        expect(r.payload).toBe(raw);
    });

    it("payload raksasa di-strip bertahap: icon/badge/sound → speakText → body; title & data tetap", () => {
        const huge = "x".repeat(6000);
        const obj = {
            title: "Pesanan siap",
            body: huge,
            speakText: huge,
            icon: "data:image/png;base64," + "A".repeat(90000),
            badge: "data:image/png;base64," + "A".repeat(90000),
            sound: "/sounds/ready.mp3",
            data: { url: "/m/x?order=t" }
        };
        const r = fitPushPayload(JSON.stringify(obj));
        expect(r.stripped).toBe(true);
        const out = JSON.parse(r.payload);
        expect(out.icon).toBeUndefined();
        expect(out.badge).toBeUndefined();
        expect(out.sound).toBeUndefined();
        expect(out.speakText).toBeUndefined();
        expect(out.body).toBeUndefined();
        expect(out.title).toBe("Pesanan siap");
        expect(out.data.url).toBe("/m/x?order=t");
        expect(Buffer.byteLength(r.payload, "utf-8")).toBeLessThanOrEqual(PUSH_PAYLOAD_MAX_BYTES);
    });

    it("menerima objek (bukan string) dan non-JSON dibiarkan apa adanya", () => {
        const r = fitPushPayload({ title: "ok", data: { url: "/m/y" } });
        expect(JSON.parse(r.payload).title).toBe("ok");
        expect(r.stripped).toBe(false);
        const raw = fitPushPayload("plain text");
        expect(raw.payload).toBe("plain text");
    });
});

describe("classifyPushError — status code push", () => {
    it("404/410 (subscription hilang) → delete", () => {
        expect(classifyPushError(404)).toBe("delete");
        expect(classifyPushError(410)).toBe("delete");
    });

    it("400/401/403 (VAPID mismatch / key invalid) → delete (subscription tidak pernah bisa dipakai lagi)", () => {
        expect(classifyPushError(400)).toBe("delete");
        expect(classifyPushError(401)).toBe("delete");
        expect(classifyPushError(403)).toBe("delete");
    });

    it("413 (payload terlalu besar) → payload-too-large — JANGAN hapus subscription", () => {
        expect(classifyPushError(413)).toBe("payload-too-large");
    });

    it("status lain / tanpa status → retryable", () => {
        expect(classifyPushError(500)).toBe("retryable");
        expect(classifyPushError(undefined)).toBe("retryable");
    });
});
