/**
 * Payment Model — pembayaran invoice (SP-029 M6 §22-23).
 *
 * BILLING ≠ PAYMENT: payment adalah entity terpisah dengan lifecycle sendiri.
 * transactionReference unique → idempotency (webhook ganda tidak membuat
 * 2 payment). Provider abstraction — tidak terikat satu provider.
 *
 * @module console/server/models/Payment
 */

import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    amount: { type: Number, required: true, min: 0 }, // integer minor units
    currency: { type: String, default: "IDR" },

    method: { type: String, default: "BANK_TRANSFER", enum: ["BANK_TRANSFER", "VIRTUAL_ACCOUNT", "EWALLET", "CARD", "MANUAL", "SIMULATION"] },
    provider: { type: String, default: "manual" }, // abstraction: manual | midtrans | xendit | ...
    transactionReference: { type: String, default: "", unique: true }, // dari provider / manual

    status: {
        type: String,
        default: "PENDING",
        enum: ["PENDING", "PAID", "FAILED", "EXPIRED", "REFUNDED", "CANCELLED"]
    },

    paidAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: String, default: "" },

    metadata: { type: Object, default: {} }, // payload webhook mentah (tidak dipercaya langsung)
    notes: { type: String, default: "" },
    createdBy: { type: String, default: "" }
}, { timestamps: true });

paymentSchema.index({ invoiceId: 1, createdAt: 1 });
paymentSchema.index({ companyId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
