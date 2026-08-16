/**
 * TableOrder Model — Order Meja (F&B Customer Ordering V1).
 *
 * Order yang dibuat CUSTOMER dari QR Menu Meja (orderSource = "qr_table").
 * Order dibedakan menggunakan orderId/orderNumber — QR meja TIDAK berubah
 * antar order (Customer A order #001, Customer B order #002 di meja sama).
 *
 * Payment TIDAK otomatis: semua order dibuat paymentStatus = "pending".
 * Kasir mengkonfirmasi secara manual (PENDING → PAID, confirmation_method
 * "manual"). Kitchen TIDAK menunggu payment — order masuk kitchen segera
 * setelah dibuat (kitchenStatus NEW → PREPARING → READY → SERVED/COLLECTED).
 *
 * `orderToken` = secret acak utk customer (status order + web push
 * subscription) — customer TIDAK pernah melihat/mengubah company/table.
 *
 * @module server/models/TableOrder
 */

import mongoose from "mongoose";

const tableOrderItemSchema = new mongoose.Schema({
    // Referensi produk (Barang._id) + snapshot display.
    productId: { type: String, required: true },
    kode:      { type: String, default: "" },
    nama:      { type: String, required: true },
    // M6.2-FIX v0.43 — SKU varian marketplace yang dipilih customer.
    skuKode:   { type: String, default: "" },
    skuLabel:  { type: String, default: "" },
    // M6.2-FIX v0.42 — varian Recipe F&B yang dipilih customer (Recipe._id).
    recipeId:  { type: String, default: "" },
    recipeNama:{ type: String, default: "" },
    // Harga SATUAN per item (snapshot dari produk/varian — harga tidak
    // dikirim client; server yang menghitung dari master data).
    harga:     { type: Number, required: true, min: 0 },
    qty:       { type: Number, required: true, min: 1 },
    subtotal:  { type: Number, required: true, min: 0 },
    // Catatan customer per item (mis. "tanpa es").
    catatan:   { type: String, default: "" },
    // ── F&B V1 — Pembatalan PER-ITEM (kitchen) ──
    // itemId = id baris stabil (dibuat server saat order dibuat: "<orderNumber>-<idx>") —
    // dipakai kitchen untuk membatalkan SATU baris (mis. 2 item dapur) tanpa
    // membatalkan order lain. Data legacy tanpa itemId tidak bisa dibatalkan
    // per-item (fallback: batalkan seluruh order).
    itemId:     { type: String, default: "" },
    cancelled:  { type: Boolean, default: false },
    cancelledAt:{ type: Date, default: null },
    cancelledBy:{ type: String, default: "" },
    cancelReason:{ type: String, default: "" }
}, { _id: false });

const tableOrderSchema = new mongoose.Schema({
    companyCode: { type: String, required: true, index: true },
    // Lokasi + meja (resolve dari qrIdentifier di server — client TIDAK
    // mengirim company/table).
    lokasiId:    { type: String, default: "" },
    lokasiNama:  { type: String, default: "" },
    tableId:     { type: String, required: true },
    nomorMeja:   { type: String, required: true },
    // Nomor order per company (ORDER #000125) — sequential.
    orderNumber: { type: Number, required: true },
    orderId:     { type: String, required: true },
    orderSource: { type: String, default: "qr_table", enum: ["qr_table", "pos"] },
    items:       { type: [tableOrderItemSchema], default: [] },
    subtotal:    { type: Number, default: 0, min: 0 },
    // Pajak & diskon transaksi (V1: pajak mengikuti setting company;
    // diskon belum dipakai customer — placeholder 0).
    pajak:       { type: Number, default: 0, min: 0 },
    diskon:      { type: Number, default: 0, min: 0 },
    total:       { type: Number, default: 0, min: 0 },
    // ── Payment ──
    paymentMethod: { type: String, default: "cash", enum: ["cash", "qris", "transfer"] },
    paymentStatus: { type: String, default: "pending", enum: ["pending", "paid"] },
    confirmedBy:   { type: String, default: "" },
    confirmedAt:   { type: Date, default: null },
    confirmationMethod: { type: String, default: "manual", enum: ["manual"] },
    // ── Kitchen ──
    // NEW → PREPARING → READY → (SERVED / COLLECTED).
    // BISA DIBATALKAN (kitchen) SEBELUM READY: "cancelled" — kitchen
    // membatalkan order (new/preparing); kasir & customer diberi notifikasi.
    kitchenStatus: { type: String, default: "new", enum: ["new", "preparing", "ready", "served", "collected", "cancelled"] },
    // ── Cancellation (Kitchen) ──
    // Berlaku utk pembatalan SELURUH order; pembatalan per-item ditandai
    // di tiap baris (item.cancelled) + ringkasan cancelledSubtotal di bawah.
    cancelledAt:  { type: Date, default: null },
    cancelledBy:  { type: String, default: "" },
    cancelReason: { type: String, default: "" },
    // Nilai subtotal (sebelum pajak) dari baris yang DIBATALKAN — dipakai
    // menghitung refund parsial: refund = cancelledSubtotal × (1 + pajak%).
    cancelledSubtotal: { type: Number, default: 0, min: 0 },
    // ── Refund (Kasir) ──
    // Order dibatalkan (sebagian/seluruh) & payment sudah PAID → refundStatus
    // "pending" (kasir wajib refund). refundAmount dihitung SERVER saat
    // pembatalan: seluruh order = total; parsial = subtotal item dibatalkan
    // + pajak proporsional. Setelah kasir proses refund → "refunded".
    // Refund ini menjadi PENGURANG nilai penjualan saat tutup shift
    // (Shift.totalRefund — Shift hanya menjumlahkan refundAmount).
    refundStatus:   { type: String, default: "none", enum: ["none", "pending", "refunded"] },
    refundAmount:   { type: Number, default: 0, min: 0 },
    refundedAt:     { type: Date, default: null },
    refundedBy:     { type: String, default: "" },
    refundedUsername: { type: String, default: "" },
    // F&B V1 — HANYA order yang mengandung produk RECIPE / RECIPE-FNB yang
    // masuk kitchen. `hasKitchenItems` ditentukan SERVER saat order dibuat
    // (dari behavior master Barang); order trading/service SAJA → false dan
    // kitchenStatus langsung "ready" (disiapkan kasir, bukan dapur).
    hasKitchenItems: { type: Boolean, default: false },
    // Subset item yang dikerjakan DAPUR (behavior recipe / recipe-fnb) —
    // kitchen hanya menampilkan ini (barang dagangan & jasa diserahkan
    // bersamaan saat resep selesai, bukan dikerjakan dapur).
    kitchenItems:    { type: [tableOrderItemSchema], default: [] },
    readyAt:       { type: Date, default: null },
    readyBy:       { type: String, default: "" },
    servedAt:      { type: Date, default: null },
    servedBy:      { type: String, default: "" },
    // Secret customer: token acak utk lihat status + subscribe push.
    orderToken:  { type: String, required: true, unique: true },
    // qrIdentifier meja asal order — dipakai deep-link notifikasi push
    // (customer dibawa kembali ke status order-nya).
    qrIdentifier: { type: String, default: "" },
    // Catatan order (customer, opsional).
    catatanOrder:{ type: String, default: "" },
    // F&B V1 — nomor WhatsApp CUSTOMER (diisi saat checkout). Dipakai kirim
    // notifikasi status order via WhatsApp (Sidobe): diterima, siap,
    // pembayaran dikonfirmasi, batal, refund. Additive — order lama tanpa
    // field ini tidak menerima notifikasi WA (tetap Web Push).
    customerWhatsapp: { type: String, default: "" },
    createdBy:   { type: String, default: "customer" }
}, { timestamps: true });

// Nomor order sequential per company.
tableOrderSchema.index({ companyCode: 1, orderNumber: 1 }, { unique: true });

export const TableOrder = mongoose.model("TableOrder", tableOrderSchema);
