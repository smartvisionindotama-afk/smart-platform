/**
 * wa-notify.test.js — unit test service notifikasi WA (Sidobe).
 *
 * Coverage: normalisasi nomor HP (E.164), label meja tanpa awalan ganda,
 * builder pesan per event (received/ready/paid/cancelled/items_cancelled/
 * refunded), status URL deep-link, dan pengiriman Sidobe (mocked fetch).
 *
 * @module server/__tests__/wa-notify
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock model Company — loadWaConfig() query DB; di unit test tidak ada
// koneksi mongoose.
vi.mock("../models/Company.js", () => ({
    Company: { findOne: vi.fn() }
}));
vi.mock("../models/BankAccount.js", () => ({
    BankAccount: { find: vi.fn() }
}));
import { Company } from "../models/Company.js";
import { BankAccount } from "../models/BankAccount.js";
import {
    normalizeWaPhone,
    normalizeMejaLabel,
    statusUrlOf,
    normalizeProviderBase,
    DEFAULT_WA_PROVIDER_URL,
    buildWaOrderMessage,
    sendWaText,
    notifyOrderWhatsapp
} from "../services/wa-notify.js";

const BASE_ORDER = {
    nomorMeja: "Meja 05",
    orderId: "ORDER #000125",
    total: 43290,
    paymentStatus: "pending",
    qrIdentifier: "abc123",
    orderToken: "tok123"
};

describe("normalizeWaPhone — nomor HP → E.164 (+62)", () => {
    it("awalan 0 → +62 (tanpa 0)", () => {
        expect(normalizeWaPhone("081234567890")).toBe("+6281234567890");
    });
    it("awalan 8 → +62 + nomor", () => {
        expect(normalizeWaPhone("81234567890")).toBe("+6281234567890");
    });
    it("format bebas (spasi, strip, kurung) dibersihkan", () => {
        expect(normalizeWaPhone("+62 812-3456-7890")).toBe("+6281234567890");
    });
    it("sudah +62 dipertahankan", () => {
        expect(normalizeWaPhone("+6281234567890")).toBe("+6281234567890");
    });
    it("kosong / tidak ada digit → ''", () => {
        expect(normalizeWaPhone("")).toBe("");
        expect(normalizeWaPhone("abc")).toBe("");
        expect(normalizeWaPhone(null)).toBe("");
    });
});

describe("normalizeMejaLabel — tanpa awalan 'Meja' ganda", () => {
    it("\"Meja 05\" → \"05\"", () => {
        expect(normalizeMejaLabel("Meja 05")).toBe("05");
    });
    it("\"meja 001\" (huruf kecil) → \"001\"", () => {
        expect(normalizeMejaLabel("meja 001")).toBe("001");
    });
    it("tanpa awalan → apa adanya", () => {
        expect(normalizeMejaLabel("5")).toBe("5");
        expect(normalizeMejaLabel("Meja")).toBe("Meja");
    });
    it("kosong → '-'", () => {
        expect(normalizeMejaLabel("")).toBe("-");
        expect(normalizeMejaLabel(null)).toBe("-");
    });
});

describe("statusUrlOf — deep-link status customer", () => {
    it("qrIdentifier + orderToken → URL /m/...", () => {
        expect(statusUrlOf({ qrIdentifier: "abc123", orderToken: "tok" })).toBe(
            "https://pos.e-profit.id/m/abc123?order=tok"
        );
    });
    it("tanpa identifier/token → ''", () => {
        expect(statusUrlOf({ qrIdentifier: "abc" })).toBe("");
        expect(statusUrlOf({})).toBe("");
    });
});

describe("buildWaOrderMessage — pesan per event", () => {
    it("received — konfirmasi + meja + total + instruksi pembayaran (spasi setelah Total, TANPA link status)", () => {
        const msg = buildWaOrderMessage(BASE_ORDER, "received");
        expect(msg).toContain("diterima");
        expect(msg).toContain("Meja: 05");       // meja tanpa 'Meja' ganda
        expect(msg).toContain("ORDER #000125");
        expect(msg).toContain("Rp 43.290");
        // Baris kosong setelah Total, sebelum "Silahkan lakukan pembayaran"
        expect(msg).toContain("Total: Rp 43.290\n\nSilahkan lakukan pembayaran");
        // Instruksi pembayaran (tunai / QRIS / transfer) + kirim bukti di chat
        expect(msg).toContain("Bayar tunai di kasir");
        expect(msg).toContain("Scan QRIS yang ada di meja");
        expect(msg).toContain("kirim bukti scan/transfer di chat ini");
        // Link status TIDAK lagi di pesan received (pindah ke paid)
        expect(msg).not.toContain("Lihat status");
        expect(msg).not.toContain("https://pos.e-profit.id");
    });

    it("received — rekening aktif dari Payment Settings ditampilkan di instruksi transfer", () => {
        const msg = buildWaOrderMessage(BASE_ORDER, "received", {
            bankAccounts: [
                { bankName: "Bank Mandiri", accountNumber: "123456789", accountName: "PT ABC" },
                { bankName: "BCA", accountNumber: "987654321", accountName: "PT ABC" }
            ]
        });
        expect(msg).toContain("c. Transfer pada rekening berikut:");
        expect(msg).toContain("Bank Mandiri: 123456789 a.n. PT ABC");
        expect(msg).toContain("BCA: 987654321 a.n. PT ABC");
        expect(msg).not.toContain("Transfer pada rekening yang tersedia di meja");
    });

    it("received — tanpa rekening → fallback instruksi umum", () => {
        const msg = buildWaOrderMessage(BASE_ORDER, "received", { bankAccounts: [] });
        expect(msg).toContain("c. Transfer pada rekening yang tersedia di meja");
    });
    it("ready — pesanan siap + link status di bawahnya", () => {
        const msg = buildWaOrderMessage(BASE_ORDER, "ready");
        expect(msg).toContain("sudah siap");
        expect(msg).toContain("ORDER #000125");
        expect(msg).toContain("05");
        // Link status WAJIB ada di bawah pesan siap (permintaan user)
        expect(msg).toContain("Lihat status: https://pos.e-profit.id/m/abc123?order=tok123");
        const lines = msg.split("\n");
        expect(lines[lines.length - 1]).toContain("Lihat status");
    });
    it("preparing — pesanan sedang dikerjakan + link status", () => {
        const msg = buildWaOrderMessage(BASE_ORDER, "preparing");
        expect(msg).toContain("sedang dalam pengerjaan");
        expect(msg).toContain("Meja: 05 · ORDER #000125");
        expect(msg).toContain("Lihat status: https://pos.e-profit.id/m/abc123?order=tok123");
    });
    it("preparing — tanpa qrIdentifier/token → tanpa link status", () => {
        const msg = buildWaOrderMessage({ ...BASE_ORDER, qrIdentifier: "", orderToken: "" }, "preparing");
        expect(msg).toContain("sedang dalam pengerjaan");
        expect(msg).not.toContain("Lihat status");
    });
    it("paid — pembayaran dikonfirmasi + link status di bawahnya", () => {
        const msg = buildWaOrderMessage(BASE_ORDER, "paid");
        expect(msg).toContain("dikonfirmasi");
        expect(msg).toContain("ORDER #000125 · Total Rp 43.290");
        expect(msg).toContain("Terima kasih");
        // Link status pindah ke sini — baris terakhir setelah baris kosong
        expect(msg).toContain("\n\nLihat status: https://pos.e-profit.id/m/abc123?order=tok123");
        const lines = msg.split("\n");
        expect(lines[lines.length - 1]).toContain("Lihat status");
    });
    it("cancelled — lunas → info refund; belum lunas → hubungi kasir", () => {
        const paid = buildWaOrderMessage({ ...BASE_ORDER, paymentStatus: "paid" }, "cancelled");
        expect(paid).toContain("dibatalkan");
        expect(paid).toContain("direfund");
        const unpaid = buildWaOrderMessage({ ...BASE_ORDER, paymentStatus: "pending" }, "cancelled");
        expect(unpaid).toContain("hubungi kasir");
        expect(unpaid).not.toContain("direfund");
    });
    it("items_cancelled — daftar item dibatalkan + refund parsial bila lunas", () => {
        const order = {
            ...BASE_ORDER,
            paymentStatus: "paid",
            refundAmount: 25000,
            items: [
                { nama: "Nasi Goreng", qty: 2, cancelled: true },
                { nama: "Es Teh", qty: 1, cancelled: false }
            ]
        };
        const msg = buildWaOrderMessage(order, "items_cancelled");
        expect(msg).toContain("dibatalkan");
        expect(msg).toContain("2× Nasi Goreng");
        expect(msg).toContain("Rp 25.000");
    });
    it("refunded — nominal refund", () => {
        const msg = buildWaOrderMessage({ ...BASE_ORDER, refundAmount: 43290 }, "refunded");
        expect(msg).toContain("direfund");
        expect(msg).toContain("Rp 43.290");
    });
    it("event tidak dikenal → ''", () => {
        expect(buildWaOrderMessage(BASE_ORDER, "whatever")).toBe("");
        expect(buildWaOrderMessage(BASE_ORDER, "")).toBe("");
    });
});

describe("normalizeProviderBase — URL provider → base endpoint", () => {
    it("URL penuh .../send-message → base .../v1", () => {
        expect(normalizeProviderBase("https://api.sidobe.com/wa/v1/send-message")).toBe("https://api.sidobe.com/wa/v1");
    });
    it("URL tanpa /send-message → apa adanya (tanpa slash akhir)", () => {
        expect(normalizeProviderBase("https://api.sidobe.com/wa/v1/")).toBe("https://api.sidobe.com/wa/v1");
    });
    it("kosong → default base", () => {
        expect(normalizeProviderBase("")).toBe(DEFAULT_WA_PROVIDER_URL.replace(/\/send-message$/, ""));
        expect(normalizeProviderBase(null)).toBe(DEFAULT_WA_PROVIDER_URL.replace(/\/send-message$/, ""));
    });
});

describe("sendWaText — pengiriman Sidobe (mocked fetch)", () => {
    let fetchMock;

    beforeEach(() => {
        fetchMock = vi.fn();
        global.fetch = fetchMock;
    });
    afterEach(() => {
        vi.restoreAllMocks();
        delete global.fetch;
    });

    it("tanpa secret → tidak kirim, error no-secret", async () => {
        delete process.env.SIDOBE_SECRET_KEY;
        delete process.env.WA_SECRET_KEY;
        const r = await sendWaText("081234567890", "halo");
        expect(r.ok).toBe(false);
        expect(r.error).toBe("no-secret");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("tanpa nomor valid → no-phone", async () => {
        process.env.SIDOBE_SECRET_KEY = "sekret";
        const r = await sendWaText("", "halo");
        expect(r.ok).toBe(false);
        expect(r.error).toBe("no-phone");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sukses → kirim ke endpoint dgn header X-Secret-Key + body E.164", async () => {
        process.env.SIDOBE_SECRET_KEY = "sekret";
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ is_success: true })
        });
        const r = await sendWaText("0812-3456-7890", "Pesan tes");
        expect(r.ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe("https://api.sidobe.com/wa/v1/send-message");
        expect(opts.headers["X-Secret-Key"]).toBe("sekret");
        const body = JSON.parse(opts.body);
        expect(body.phone).toBe("+6281234567890");
        expect(body.message).toBe("Pesan tes");
    });

    it("config per-company menimpa env — providerUrl + secretKey + senderNumber", async () => {
        delete process.env.SIDOBE_SECRET_KEY;
        delete process.env.WA_SECRET_KEY;
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ is_success: true })
        });
        const r = await sendWaText("081234567890", "halo", {
            providerUrl: "https://api.sidobe.com/wa/v1/send-message",
            secretKey: "secret-company",
            senderNumber: "081111111111"
        });
        expect(r.ok).toBe(true);
        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe("https://api.sidobe.com/wa/v1/send-message");
        expect(opts.headers["X-Secret-Key"]).toBe("secret-company");
        const body = JSON.parse(opts.body);
        expect(body.phone).toBe("+6281234567890");
        expect(body.sender_phone).toBe("+6281111111111");
    });

    it("provider URL custom (bukan Sidobe) dipakai apa adanya", async () => {
        process.env.SIDOBE_SECRET_KEY = "sekret";
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ is_success: true })
        });
        const r = await sendWaText("081234567890", "halo", {
            providerUrl: "https://gw.example.com/wa/v2/send-message",
            secretKey: "sekret"
        });
        expect(r.ok).toBe(true);
        const [url] = fetchMock.mock.calls[0];
        expect(url).toBe("https://gw.example.com/wa/v2/send-message");
    });

    it("tanpa senderNumber → body tidak memuat sender_phone", async () => {
        process.env.SIDOBE_SECRET_KEY = "sekret";
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ is_success: true })
        });
        await sendWaText("081234567890", "halo", { providerUrl: "", secretKey: "sekret" });
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.sender_phone).toBeUndefined();
    });

    it("response is_success=false → ok:false", async () => {
        process.env.SIDOBE_SECRET_KEY = "sekret";
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ is_success: false, message: "nomor tidak terdaftar" })
        });
        const r = await sendWaText("081234567890", "halo");
        expect(r.ok).toBe(false);
        expect(r.error).toContain("nomor tidak terdaftar");
    });

    it("HTTP error → ok:false dengan status", async () => {
        process.env.SIDOBE_SECRET_KEY = "sekret";
        fetchMock.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ message: "unauthorized" })
        });
        const r = await sendWaText("081234567890", "halo");
        expect(r.ok).toBe(false);
        expect(r.status).toBe(401);
    });

    it("fetch throw → ok:false, TIDAK throw (fire and forget)", async () => {
        process.env.SIDOBE_SECRET_KEY = "sekret";
        fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
        const r = await sendWaText("081234567890", "halo");
        expect(r.ok).toBe(false);
        expect(r.error).toContain("ECONNREFUSED");
    });
});

describe("notifyOrderWhatsapp — kirim per event", () => {
    let fetchMock;

    beforeEach(() => {
        fetchMock = vi.fn();
        global.fetch = fetchMock;
        process.env.SIDOBE_SECRET_KEY = "sekret";
        // loadWaConfig memakai chain .select().lean() — stub penuh.
        Company.findOne.mockReturnValue({
            select: () => ({ lean: async () => ({}) })   // tanpa konfigurasi company
        });
        // loadBankAccounts memakai chain .select().sort().lean()
        BankAccount.find.mockReturnValue({
            select: () => ({ sort: () => ({ lean: async () => [] }) })  // tanpa rekening
        });
    });
    afterEach(() => {
        vi.restoreAllMocks();
        delete global.fetch;
        delete process.env.SIDOBE_SECRET_KEY;
    });

    it("tanpa customerWhatsapp → no-customer-wa (tidak kirim)", async () => {
        const r = await notifyOrderWhatsapp({ ...BASE_ORDER }, "ready");
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("no-customer-wa");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("dengan nomor → kirim pesan event ke nomor customer", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ is_success: true })
        });
        const order = { ...BASE_ORDER, customerWhatsapp: "081234567890", companyCode: "ABC" };
        const r = await notifyOrderWhatsapp(order, "ready");
        expect(r.ok).toBe(true);
        const [url, opts] = fetchMock.mock.calls[0];
        const body = JSON.parse(opts.body);
        expect(body.phone).toBe("+6281234567890");
        expect(body.message).toContain("sudah siap");
        expect(body.message).toContain("Lihat status: https://pos.e-profit.id/m/abc123?order=tok123");
        expect(url).toContain("/send-message");
        // loadWaConfig memakai companyCode order
        expect(Company.findOne).toHaveBeenCalledWith({ code: "ABC" });
    });

    it("event preparing (kitchen TERIMA) → kirim pesan pengerjaan + link status", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ is_success: true })
        });
        const order = { ...BASE_ORDER, customerWhatsapp: "081234567890", companyCode: "ABC" };
        const r = await notifyOrderWhatsapp(order, "preparing");
        expect(r.ok).toBe(true);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.message).toContain("sedang dalam pengerjaan");
        expect(body.message).toContain("Meja: 05 · ORDER #000125");
        expect(body.message).toContain("Lihat status: https://pos.e-profit.id/m/abc123?order=tok123");
    });

    it("konfigurasi company (secret company) dipakai, bukan env", async () => {
        delete process.env.SIDOBE_SECRET_KEY;
        delete process.env.WA_SECRET_KEY;
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ is_success: true })
        });
        Company.findOne.mockReturnValue({
            select: () => ({
                lean: async () => ({
                    waProviderUrl: "https://api.sidobe.com/wa/v1/send-message",
                    waSecretKey: "secret-company",
                    waSenderNumber: "081111111111"
                })
            })
        });
        const order = { ...BASE_ORDER, customerWhatsapp: "081234567890", companyCode: "ABC" };
        const r = await notifyOrderWhatsapp(order, "paid");
        expect(r.ok).toBe(true);
        const opts = fetchMock.mock.calls[0][1];
        expect(opts.headers["X-Secret-Key"]).toBe("secret-company");
        const body = JSON.parse(opts.body);
        expect(body.sender_phone).toBe("+6281111111111");
    });

    it("event tidak dikenal → unknown-event (tidak kirim)", async () => {
        const r = await notifyOrderWhatsapp({ ...BASE_ORDER, customerWhatsapp: "081234567890" }, "nope");
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("unknown-event");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
