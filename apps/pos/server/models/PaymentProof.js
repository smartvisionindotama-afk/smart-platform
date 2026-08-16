/**
 * PaymentProof Model — Bukti Pembayaran customer (F&B Customer Ordering V1).
 *
 * Customer QRIS/Transfer dapat meng-upload bukti transaksi (screenshot/foto)
 * untuk DIPERIKSA KASIR — upload TIDAK otomatis mengubah paymentStatus
 * (safety: PENDING → PAID HANYA setelah kasir verifikasi, verification_method
 * MANUAL).
 *
 * History dipertahankan: customer boleh upload ulang bila bukti ditolak,
 * namun bukti LAMA TIDAK dihapus (Proof #1 REJECTED → Proof #2 PENDING →
 * Proof #3 APPROVED — semua tersimpan, audit lengkap).
 *
 * Penyimpanan gambar memakai mekanisme existing: data URI (pola foto produk)
 * — TIDAK ada file publik / URL unrestricted (security §16).
 *
 * @module server/models/PaymentProof
 */

import mongoose from "mongoose";

const paymentProofSchema = new mongoose.Schema({
    // Multi-tenant: company scope (resolve dari orderToken di server).
    companyCode: { type: String, required: true, index: true },
    // Referensi order (TableOrder._id) + snapshot display (history tetap
    // terbaca walau nomor meja diubah setelah order dibuat).
    orderId:     { type: String, required: true, index: true },
    orderToken:  { type: String, default: "" },
    orderNumber: { type: Number, default: 0 },
    nomorMeja:   { type: String, default: "" },
    // File bukti — data URI JPEG/PNG/WEBP hasil kompresi client-side.
    mimeType:    { type: String, default: "" },
    dataUri:     { type: String, default: "" },
    // ── Status verifikasi ──
    // PENDING → APPROVED | REJECTED (default PENDING — menunggu kasir).
    status:      { type: String, default: "pending", enum: ["pending", "approved", "rejected"] },
    // Siapa meng-upload: "customer" (belum ada login) atau nama (via token).
    uploadedBy:  { type: String, default: "customer" },
    // Audit verifikasi (MANUAL oleh kasir).
    verifiedBy:  { type: String, default: "" },
    verifiedAt:  { type: Date, default: null },
    verificationMethod: { type: String, default: "", enum: ["", "manual"] },
    // Alasan penolakan (opsional — kasir dapat menulis catatan).
    rejectionReason: { type: String, default: "" }
}, { timestamps: true });

// Satu order boleh punya banyak bukti (history), tapi SATU yang pending
// aktif (upload ulang hanya setelah REJECTED — di-enforce di route).
paymentProofSchema.index({ companyCode: 1, orderId: 1, status: 1 });
paymentProofSchema.index({ companyCode: 1, status: 1, createdAt: -1 });

export const PaymentProof = mongoose.model("PaymentProof", paymentProofSchema);
