/**
 * Feature Model — catalog fitur komersial (SP-029 M6 §9-10).
 *
 * FEATURE ≠ APPLICATION: satu aplikasi dapat memiliki beberapa fitur
 * komersial (mis. e-Profit: Accounting, Inventory, POS, AI Accounting).
 * Feature adalah catalog/configuration — jangan hardcode di aplikasi.
 *
 * @module console/server/models/Feature
 */

import mongoose from "mongoose";

const featureSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, default: "general" }, // accounting | inventory | pos | ai | api | ...

    // Unit limit default (mis. USER, TRANSACTION, DOCUMENT, STORAGE, API_CALL, AI_TOKEN)
    unit: { type: String, default: "FEATURE" },

    // Harga default fitur di katalog (integer minor units, IDR = rupiah).
    // Dapat di-override per perusahaan melalui Entitlement.price.
    price: { type: Number, default: 0, min: 0 },

    status: { type: String, default: "active", enum: ["active", "inactive"] },
    sortOrder: { type: Number, default: 0 },

    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

featureSchema.index({ slug: 1 }, { unique: true });

export const Feature = mongoose.model("Feature", featureSchema);
export default Feature;
