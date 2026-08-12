/**
 * Subscription Model — langganan company (SP-029 M6 §13-14).
 *
 * Lifecycle eksplisit (bukan hanya active=true):
 *   TRIAL → ACTIVE → PAST_DUE → SUSPENDED → CANCELLED | EXPIRED
 * Transition divalidasi server-side (state machine), bukan arbitrary update.
 *
 * @module console/server/models/Subscription
 */

import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },

    status: {
        type: String,
        default: "TRIAL",
        enum: ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"]
    },

    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    billingCycle: { type: String, default: "MONTHLY", enum: ["MONTHLY", "YEARLY", "CUSTOM"] },
    // Snapshot harga saat subscribe (integer minor units) — perubahan harga
    // plan di masa depan tidak mengubah subscription lama.
    price: { type: Number, default: 0 },
    currency: { type: String, default: "IDR" },

    autoRenew: { type: Boolean, default: true },

    // Trial
    trialStart: { type: Date, default: null },
    trialEnd: { type: Date, default: null },

    // Cancellation
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, default: "" },
    cancelReason: { type: String, default: "" },
    cancelEffectiveDate: { type: Date, default: null }, // null = cancel immediate

    createdBy: { type: String, default: "" },
    notes: { type: String, default: "" }
}, { timestamps: true });

subscriptionSchema.index({ companyId: 1, createdAt: -1 });
subscriptionSchema.index({ status: 1, endDate: 1 });

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
export default Subscription;
