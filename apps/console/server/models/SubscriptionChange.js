/**
 * SubscriptionChange Model — riwayat perubahan subscription (SP-029 M6 §15, §50).
 *
 * Upgrade/downgrade/renewal/suspension/cancellation/expiration harus dapat
 * ditelusuri. Jangan sekadar mengganti planId — catat old/new + alasan.
 *
 * @module console/server/models/SubscriptionChange
 */

import mongoose from "mongoose";

const subscriptionChangeSchema = new mongoose.Schema({
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    changeType: {
        type: String,
        required: true,
        enum: ["create", "activate", "trial_to_active", "renew", "upgrade", "downgrade", "suspend", "resume", "cancel", "expire", "change_plan"]
    },

    oldPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
    newPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },

    oldStatus: { type: String, default: "" },
    newStatus: { type: String, default: "" },

    effectiveDate: { type: Date, default: null },
    proration: { type: String, default: "none", enum: ["none", "full", "partial"] }, // policy sederhana

    reason: { type: String, default: "" },
    createdBy: { type: String, default: "" }
}, { timestamps: true });

subscriptionChangeSchema.index({ subscriptionId: 1, createdAt: 1 });
subscriptionChangeSchema.index({ companyId: 1, createdAt: -1 });

export const SubscriptionChange = mongoose.model("SubscriptionChange", subscriptionChangeSchema);
export default SubscriptionChange;
