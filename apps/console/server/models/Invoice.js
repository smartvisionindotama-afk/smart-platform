/**
 * Invoice Model — tagihan per billing period (SP-029 M6 §18-20, §27).
 *
 * Invoice adalah entity terpisah dari payment. Total dihitung SERVER-SIDE
 * (integer minor units) — frontend tidak menentukan total.
 * invoiceNumber unique & reproducible (bukan _id, bukan dari frontend).
 * Anti double-billing: unique index (subscriptionId, periodStart, periodEnd).
 *
 * @module console/server/models/Invoice
 */

import mongoose from "mongoose";

const invoiceItemSchema = new mongoose.Schema({
    kind: { type: String, default: "plan", enum: ["plan", "feature", "addon", "discount", "tax", "adjustment"] },
    label: { type: String, default: "" },
    amount: { type: Number, default: 0 }, // integer minor units
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, default: 0 },
    refType: { type: String, default: "" },
    refId: { type: String, default: "" }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", default: null },

    invoiceNumber: { type: String, required: true, unique: true }, // INV/2026/08/000123

    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    items: { type: [invoiceItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 }, // persen; policy mengikuti business/legal
    total: { type: Number, default: 0 },
    currency: { type: String, default: "IDR" },

    status: {
        type: String,
        default: "DRAFT",
        enum: ["DRAFT", "ISSUED", "PENDING", "PAID", "OVERDUE", "VOID", "CANCELLED"]
    },

    issuedAt: { type: Date, default: null },
    dueAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },

    notes: { type: String, default: "" },
    createdBy: { type: String, default: "" }
}, { timestamps: true });

// Anti double billing:
// - Invoice berbasis subscription: satu subscription tidak boleh punya 2 invoice untuk period sama.
//   (partial: hanya dokumen dengan subscriptionId ObjectId — null tidak ikut unik di sini)
// - Invoice company-based (subscriptionId: null): satu company tidak boleh punya 2 invoice
//   untuk period sama (M6-FIX "Invoice by Company").
// Nama eksplisit: index lama produksi (non-partial, tanpa nama) bernama
// subscriptionId_1_periodStart_1_periodEnd_1 — nama unik mencegah tabrakan
// saat mongoose autoIndex membuat yang baru dengan opsi berbeda.
invoiceSchema.index(
    { subscriptionId: 1, periodStart: 1, periodEnd: 1 },
    { unique: true, partialFilterExpression: { subscriptionId: { $type: "objectId" } }, name: "uniq_sub_company_period" }
);
invoiceSchema.index(
    { companyId: 1, periodStart: 1, periodEnd: 1 },
    { unique: true, partialFilterExpression: { subscriptionId: { $type: "null" } }, name: "uniq_company_period_nosub" }
);
invoiceSchema.index({ companyId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1, dueAt: 1 });

export const Invoice = mongoose.model("Invoice", invoiceSchema);
export default Invoice;
