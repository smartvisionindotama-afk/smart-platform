/**
 * QrTable Model — Meja QR Menu (F&B Customer Ordering V1).
 *
 * Setiap meja memiliki QR Menu PERMANEN. QR berisi URL
 * https://pos.e-profit.id/m/{qrIdentifier} — `qrIdentifier` adalah TOKEN
 * internal (bukan nomor meja). Server melakukan resolve:
 *   qrIdentifier → company → lokasi → table
 *
 * `nomorMeja` adalah identitas yang terlihat manusia (mis. "MEJA 07") —
 * TIDAK pernah diganti dengan token. QR tidak berubah ketika dicetak ulang
 * / preview / di-download (link permanen).
 *
 * Multi-tenant: semua operasi wajib discope companyCode (enforcement di
 * route + index.js companyScope).
 *
 * @module server/models/QrTable
 */

import mongoose from "mongoose";

const qrTableSchema = new mongoose.Schema({
    companyCode: { type: String, required: true, index: true },
    // Lokasi (lokasiMode single/multi). `lokasiId` = _id Warehouse (gudang
    // sebagai lokasi operasional POS), `lokasiNama` snapshot display.
    lokasiId:   { type: String, default: "" },
    lokasiNama: { type: String, default: "" },
    // Nomor/identitas meja yang terlihat manusia (mis. "MEJA 07").
    nomorMeja:  { type: String, required: true, trim: true },
    // Token internal QR (random URL-safe). UNIQUE global — token ini kunci
    // resolve tenant; sparse agar meja yang belum di-generate tidak bentrok.
    qrIdentifier: { type: String, default: "", unique: true, sparse: true },
    // QR dinonaktifkan → halaman /m/ menampilkan "QR Menu tidak aktif".
    active:    { type: Boolean, default: true },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

// Satu nomor meja per lokasi per company (meja ganda di lokasi sama = duplikat).
qrTableSchema.index({ companyCode: 1, lokasiId: 1, nomorMeja: 1 }, { unique: true });

export const QrTable = mongoose.model("QrTable", qrTableSchema);
