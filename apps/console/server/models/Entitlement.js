/**
 * Entitlement Model — hak fitur per company (SP-029 M6 §16, §30).
 *
 * Abstraction entitlement: platform tidak hanya bergantung pada plan.
 * Source: PLAN | ADDON | PROMOTION | MANUAL.
 *
 * @module console/server/models/Entitlement
 */

import mongoose from "mongoose";

const entitlementSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    featureId: { type: mongoose.Schema.Types.ObjectId, ref: "Feature", required: true },
    featureSlug: { type: String, required: true }, // denormalisasi agar mudah query

    enabled: { type: Boolean, default: true },
    limit: { type: Number, default: null },     // null = unlimited
    used: { type: Number, default: 0 },          // snapshot usage (usage di UsageRecord)

    // Harga override per perusahaan (integer minor units). null = pakai
    // harga default dari katalog Feature.price (M6-FIX: harga per fitur).
    price: { type: Number, default: null, min: 0 },

    period: { type: String, default: "" },        // mis. "2026-08" untuk limit periodik
    source: { type: String, default: "PLAN", enum: ["PLAN", "ADDON", "PROMOTION", "MANUAL"] },

    effectiveFrom: { type: Date, default: null },
    effectiveUntil: { type: Date, default: null }, // null = tanpa batas

    // Untuk manual override: alasan wajib
    reason: { type: String, default: "" },
    // Alasan set harga (M6-FIX) — TERPISAH dari reason agar marker
    // "legacy grandfathering" pada reason tidak tertimpa saat set harga.
    priceReason: { type: String, default: "" },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" }
}, { timestamps: true });

// Satu company hanya punya SATU entitlement per feature (per source yang sama).
entitlementSchema.index({ companyId: 1, featureSlug: 1 }, { unique: true });
entitlementSchema.index({ companyId: 1, enabled: 1 });

export const Entitlement = mongoose.model("Entitlement", entitlementSchema);
export default Entitlement;
