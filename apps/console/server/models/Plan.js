/**
 * Plan Model — paket layanan komersial (SP-029 M6 §8).
 *
 * Plan adalah configuration/domain data (bukan hardcode di frontend).
 * Harga disimpan sebagai integer (minor units) — tidak floating-point.
 *
 * @module console/server/models/Plan
 */

import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },

    billingCycle: { type: String, default: "MONTHLY", enum: ["MONTHLY", "YEARLY", "CUSTOM"] },
    // Harga dalam integer minor units (untuk IDR = rupiah). JANGAN float.
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "IDR" },

    // Feature slugs yang termasuk plan (plan-feature mapping, bukan hardcode UI).
    features: { type: [String], default: [] },

    // Usage limits per feature slug: { users: 5, storage_gb: 1, ... }
    limits: { type: Object, default: {} },

    status: { type: String, default: "active", enum: ["active", "inactive"] },
    sortOrder: { type: Number, default: 0 },

    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

planSchema.index({ slug: 1 }, { unique: true });
planSchema.index({ status: 1, sortOrder: 1 });

export const Plan = mongoose.model("Plan", planSchema);
export default Plan;
