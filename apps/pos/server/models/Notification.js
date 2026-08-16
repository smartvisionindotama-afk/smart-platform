/**
 * Notification Model — Role-Based Notification Center (F&B V1).
 *
 * Satu collection untuk SEMUA notifikasi operasional yang tampil di bell:
 *   - KITCHEN  : order baru masuk (targetRole "kitchen", type "order_new")
 *   - CASHIER  : bukti pembayaran menunggu verifikasi (targetRole "cashier",
 *                type "payment_proof")
 *
 * Customer NOTIFIKASI tidak disimpan di sini — customer memakai Web Push
 * (subscription per order) karena tanpa login/session (role separation §4).
 *
 * Setiap notifikasi menyimpan (acceptance §10):
 *   notification_id, company_id, location_id (opsional), order_id,
 *   table_id (opsional), target_role, type, title, message, created_at,
 *   read_at — plus read state (UNREAD → READ).
 *
 * Multi-tenant (§8): discope companyCode (+ lokasiId bila relevan) + orderId;
 * user hanya melihat notifikasi yang permission-nya cocok (targetRole).
 *
 * @module server/models/Notification
 */

import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    // Multi-tenant — company scope (enforced companyScope global + index).
    companyCode: { type: String, required: true, index: true },
    // Lokasi/meja — lokasiId = Warehouse._id (relevan untuk kitchen/cashier).
    locationId:  { type: String, default: "" },
    tableId:     { type: String, default: "" },
    // Referensi order (TableOrder._id) + snapshot display.
    orderId:     { type: String, default: "", index: true },
    orderNumber: { type: Number, default: 0 },
    nomorMeja:   { type: String, default: "" },
    // Role tujuan — bell memfilter berdasarkan role + permission.
    targetRole:  { type: String, required: true, enum: ["cashier", "kitchen"] },
    // Jenis event (extensible).
    type:        { type: String, default: "order_new", enum: ["order_new", "payment_proof", "order_cancelled"] },
    title:       { type: String, default: "" },
    message:     { type: String, default: "" },
    // Data tambahan ringan (itemsSummary, paymentMethod, amount, dll).
    payload:     { type: mongoose.Schema.Types.Mixed, default: {} },
    // Unread / dibaca (UNREAD → READ saat notifikasi dibuka).
    read:        { type: Boolean, default: false },
    readAt:      { type: Date, default: null }
}, { timestamps: true });

// Query bell umum: per company + role, unread terbaru dulu.
notificationSchema.index({ companyCode: 1, targetRole: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
