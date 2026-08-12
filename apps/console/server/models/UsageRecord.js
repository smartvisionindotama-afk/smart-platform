/**
 * UsageRecord Model — usage metering foundation (SP-029 M6 §28-29).
 *
 * Usage dapat berasal dari: Application | API | Worker | AI | Manual Adjustment.
 * SEMUA harus memiliki source — jangan terima usage dari browser secara bebas.
 *
 * @module console/server/models/UsageRecord
 */

import mongoose from "mongoose";

const usageRecordSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    featureId: { type: mongoose.Schema.Types.ObjectId, ref: "Feature", default: null },
    featureSlug: { type: String, required: true },

    metric: { type: String, required: true },    // mis. "users", "transactions", "ai_tokens", "storage_gb"
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "COUNT" },    // COUNT | TRANSACTION | DOCUMENT | STORAGE | API_CALL | AI_TOKEN

    period: { type: String, required: true },     // "2026-08" (YYYY-MM) — agregasi per period
    source: {
        type: String,
        required: true,
        enum: ["APPLICATION", "API", "WORKER", "AI", "MANUAL"]
    },

    refType: { type: String, default: "" },       // mis. "invoice", "transaction", "document"
    refId: { type: String, default: "" },
    metadata: { type: Object, default: {} },

    recordedBy: { type: String, default: "" }
}, { timestamps: true });

// Indeks agregasi cepat per company+feature+period
usageRecordSchema.index({ companyId: 1, featureSlug: 1, period: 1 });
usageRecordSchema.index({ companyId: 1, period: 1, createdAt: -1 });

export const UsageRecord = mongoose.model("UsageRecord", usageRecordSchema);
export default UsageRecord;
