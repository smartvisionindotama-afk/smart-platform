/**
 * Shift Model — Shift Kasir (PRD V1, Part XI).
 *
 * Shift mencatat sesi kerja kasir: kas awal saat buka, transaksi yang terjadi
 * selama shift (dihitung saat tutup), dan rekonsiliasi kas (expected vs actual).
 *
 * @module server/models/Shift
 */

import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema({
    companyCode: { type: String, required: true, index: true },
    // Nama/nomor kasir (dari sesi login)
    kasir: { type: String, default: "" },
    kasirUsername: { type: String, default: "" },

    // ── Shift Opening ──
    kasAwal: { type: Number, default: 0, min: 0 },
    waktuMulai: { type: Date, default: Date.now },

    // ── Rekonsiliasi saat closing ──
    // Snapshot yang dihitung server saat tutup (dari transaksi sumber=pos).
    totalTransaksi: { type: Number, default: 0 }, // jumlah transaksi
    totalPenjualan: { type: Number, default: 0 }, // grandTotal (termasuk pajak)
    totalPajak: { type: Number, default: 0 },
    totalDiskon: { type: Number, default: 0 },
    // M6-FIX v3 — breakdown metode bayar saat tutup shift: tunai (cash) vs
    // non-tunai (transfer/qris/card). Kas diharapkan = kasAwal + penjualanTunai.
    penjualanTunai: { type: Number, default: 0 },
    penjualanNonTunai: { type: Number, default: 0 },
    // F&B V1 — REFUND pesanan dibatalkan (QR Menu, sudah lunas) yang diproses
    // kasir selama shift: PENGURANG nilai penjualan saat tutup shift.
    // totalRefund = Σ refundAmount; refundTunai = subset yang metode bayarnya
    // tunai (mengurangi kas fisik di laci — dipakai expectedCash).
    totalRefund: { type: Number, default: 0 },
    refundTunai: { type: Number, default: 0 },
    // expected = kasAwal + penjualanTunai (pembayaran non-tunai tidak menambah
    // uang fisik di laci — V1: void tidak dihitung)
    expectedCash: { type: Number, default: 0 },
    // actual = hasil hitung fisik kasir (input saat close)
    actualCash: { type: Number, default: 0 },
    // difference = actual - expected (positif = lebih, negatif = kurang)
    difference: { type: Number, default: 0 },

    // ── Shift Closing ──
    waktuTutup: { type: Date, default: null },
    status: { type: String, default: "open", enum: ["open", "closed"] },
    catatan: { type: String, default: "" },

    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

shiftSchema.index({ companyCode: 1, status: 1, waktuMulai: -1 });

export const Shift = mongoose.model("Shift", shiftSchema);
export default Shift;
