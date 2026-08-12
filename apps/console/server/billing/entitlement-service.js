/**
 * EntitlementService (SP-029 M6 §30, §55).
 *
 * canUse(companyId, featureId) → { enabled, limit, used, remaining }
 * Sumber entitlement: PLAN (dari subscription) + MANUAL override.
 * Sync dilakukan saat subscription berubah (activate/upgrade/downgrade/expire).
 *
 * @module console/server/billing/entitlement-service
 */

import mongoose from "mongoose";
import { Entitlement } from "../models/Entitlement.js";
import { UsageRecord } from "../models/UsageRecord.js";
import { Subscription } from "../models/Subscription.js";
import { Plan } from "../models/Plan.js";
import { Feature } from "../models/Feature.js";
import { Company } from "../models/Company.js";

/**
 * Komputasi entitlement lengkap untuk satu company (untuk UI Billing).
 * Menggabungkan entitlement + usage status + sumber (plan/manual).
 * @param {string} companyId
 * @returns {Promise<Array>}
 */
export async function computeForCompany(companyId) {
    const ents = await Entitlement.find({ companyId }).lean();
    const features = await Feature.find({}).lean();
    const featBySlug = new Map(features.map(f => [f.slug, f]));
    const out = [];
    for (const ent of ents) {
        const status = await canUse(companyId, ent.featureSlug);
        const feat = featBySlug.get(ent.featureSlug);
        out.push({
            companyId,
            featureSlug: ent.featureSlug,
            featureId: ent.featureId,
            featureName: feat?.name || ent.featureSlug,
            enabled: ent.enabled,
            limit: ent.limit,
            used: status.used,
            remaining: status.remaining,
            source: ent.source,
            period: ent.period,
            effectiveFrom: ent.effectiveFrom,
            effectiveUntil: ent.effectiveUntil,
            reason: ent.reason,
            // Harga per fitur (M6-FIX): override perusahaan ?? harga katalog.
            price: ent.price ?? null,
            defaultPrice: feat?.price ?? 0,
            updatedAt: ent.updatedAt
        });
    }
    out.sort((a, b) => String(a.featureSlug).localeCompare(String(b.featureSlug)));
    return out;
}

/**
 * Entitlement check untuk aplikasi — resolve company by code, lalu canUse.
 * @param {string} companyCode
 * @param {string} featureSlug
 * @param {object} [opts]
 * @returns {Promise<object>}
 */
export async function check(companyCode, featureSlug, opts = {}) {
    const company = await Company.findOne({ code: companyCode }).lean();
    if (!company) {
        return { enabled: false, reason: "company_not_found", limit: null, used: 0, remaining: 0, source: "NONE" };
    }
    const result = await canUse(String(company._id), featureSlug, opts);
    return { ...result, company: company.code, feature: featureSlug };
}

/**
 * Status usage + limit untuk satu company+feature (untuk UI).
 * @param {string} companyId
 * @param {string} featureId atau slug
 * @returns {Promise<object>}
 */
export async function getUsageStatus(companyId, featureIdOrSlug) {
    const feature = await Feature.findOne({ $or: [{ _id: featureIdOrSlug }, { slug: featureIdOrSlug }] }).lean();
    if (!feature) throw new Error(`Feature tidak ditemukan: ${featureIdOrSlug}`);
    const ent = await Entitlement.findOne({ companyId, featureSlug: feature.slug }).lean();
    const result = await canUse(companyId, feature.slug);
    return {
        feature: feature.slug,
        enabled: result.enabled,
        limit: result.limit,
        used: result.used,
        remaining: result.remaining,
        source: ent?.source || "NONE",
        period: currentPeriod(),
        effectiveUntil: ent?.effectiveUntil || null
    };
}

/**
 * Sinkronkan entitlement company dari subscription aktif (plan features).
 * Idempotent: mengaktifkan/menonaktifkan sesuai plan; MANUAL override dipertahankan.
 * @param {object} opts
 * @param {string} opts.companyId
 * @param {object} [opts.subscription] Dokumen subscription aktif (optional — cari otomatis)
 * @param {string} [opts.actor]
 * @param {string} [opts.reason]
 * @returns {Promise<{ created: number, updated: number, disabled: number }>}
 */
export async function syncEntitlementsFromSubscription({ companyId, subscription = null, actor = "", reason = "plan sync" }) {
    let sub = subscription;
    if (!sub) {
        sub = await Subscription.findOne({
            companyId,
            status: { $in: ["TRIAL", "ACTIVE", "PAST_DUE"] }
        }).sort({ createdAt: -1 });
    }
    const plan = sub ? await Plan.findById(sub.planId) : null;
    const activeFeatureSlugs = plan ? (plan.features || []) : [];

    const allFeatures = await Feature.find({}).lean();
    const bySlug = new Map(allFeatures.map(f => [f.slug, f]));

    const result = { created: 0, updated: 0, disabled: 0 };

    // Baca entitlement existing SEKALI (anti N+1), map per featureSlug.
    const existingMap = new Map();
    const existingRows = await Entitlement.find({ companyId }).lean();
    for (const e of existingRows) existingMap.set(e.featureSlug, e);

    for (const feature of allFeatures) {
        const enabled = activeFeatureSlugs.includes(feature.slug);
        const limit = enabled ? (plan.limits?.[feature.slug] ?? null) : null;
        const payload = {
            companyId,
            featureId: feature._id,
            featureSlug: feature.slug,
            enabled,
            limit,
            period: plan ? periodFromSubscription(sub) : "",
            source: "PLAN",
            effectiveFrom: sub?.startDate || null,
            effectiveUntil: sub?.endDate || null,
            reason,
            updatedBy: actor
        };

        const existing = existingMap.get(feature.slug);
        if (!existing) {
            // Upsert (bukan create) → aman dari race E11000 pada unique index.
            await Entitlement.findOneAndUpdate(
                { companyId, featureSlug: feature.slug },
                { $setOnInsert: { ...payload, createdBy: actor } },
                { upsert: true, new: true }
            );
            result.created += 1;
        } else {
            // MANUAL override tidak ditimpa oleh plan sync
            if (existing.source === "MANUAL") {
                continue;
            }
            if (existing.enabled !== enabled || existing.limit !== limit) {
                await Entitlement.updateOne(
                    { _id: existing._id },
                    { $set: { enabled, limit, source: "PLAN", period: payload.period, effectiveFrom: payload.effectiveFrom, effectiveUntil: payload.effectiveUntil, updatedBy: actor } }
                );
                result.updated += 1;
            }
        }
    }

    // Nonaktifkan entitlement plan yang tidak lagi ada di feature catalog
    const existingAll = await Entitlement.find({ companyId, source: "PLAN" }).lean();
    for (const ent of existingAll) {
        if (!bySlug.has(ent.featureSlug) || !activeFeatureSlugs.includes(ent.featureSlug)) {
            if (ent.enabled) {
                await Entitlement.updateOne({ _id: ent._id }, { $set: { enabled: false, updatedBy: actor } });
                result.disabled += 1;
            }
        }
    }

    return result;
}

function periodFromSubscription(sub) {
    return sub?.endDate ? `${sub.endDate.getUTCFullYear()}-${String(sub.endDate.getUTCMonth() + 1).padStart(2, "0")}` : "";
}

/**
 * Cek apakah company dapat menggunakan fitur.
 * @param {string} companyId
 * @param {string} featureSlug
 * @param {object} [opts] { period }
 * @returns {Promise<{ enabled: boolean, limit: number|null, used: number, remaining: number|null, source: string }>}
 */
export async function canUse(companyId, featureSlug, opts = {}) {
    const period = opts.period || currentPeriod();
    const ent = await Entitlement.findOne({ companyId, featureSlug }).lean();
    if (!ent || !ent.enabled) {
        return { enabled: false, limit: null, used: 0, remaining: 0, source: ent?.source || "NONE" };
    }

    let used = 0;
    const limit = ent.limit;
    // Selalu hitung used (agar UI menampilkan angka nyata walau unlimited),
    // gunakan companyId dari dokumen entitlement (ObjectId murni).
    const agg = await UsageRecord.aggregate([
        { $match: { companyId: ent.companyId, featureSlug, period } },
        { $group: { _id: null, total: { $sum: "$quantity" } } }
    ]);
    used = agg[0]?.total || 0;

    const remaining = limit == null ? null : Math.max(0, limit - used);
    return {
        enabled: true,
        limit,
        used,
        remaining,
        source: ent.source || "PLAN"
    };
}

/**
 * Catat usage (server-side — tidak dari browser bebas).
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function recordUsage({ companyId, featureSlug, metric, quantity, period, source, unit = "COUNT", refType = "", refId = "", actor = "", notes = "" }) {
    // featureSlug bisa berupa slug ATAU ObjectId (route usage menerima keduanya).
    let feature = null;
    if (featureSlug && /^[0-9a-fA-F]{24}$/.test(String(featureSlug))) {
        feature = await Feature.findById(featureSlug).lean();
    }
    if (!feature) {
        feature = await Feature.findOne({ slug: String(featureSlug || "").toLowerCase() }).lean();
    }
    if (!feature) throw new Error(`Feature ${featureSlug} tidak dikenal`);
    const rec = await UsageRecord.create({
        companyId,
        featureId: feature._id,
        featureSlug: feature.slug,
        metric,
        quantity: Math.trunc(Number(quantity) || 0),
        unit,
        period: period || currentPeriod(),
        source,
        refType,
        refId,
        metadata: notes ? { notes } : {},
        recordedBy: actor
    });
    // Update snapshot used pada entitlement
    await Entitlement.updateOne(
        { companyId, featureSlug: feature.slug },
        { $set: { used: await getUsed(companyId, feature.slug, period) } }
    ).catch(() => {});
    return rec;
}

async function getUsed(companyId, featureSlug, period) {
    // Cast companyId ke ObjectId bila valid — aggregation $match tidak
    // selalu me-cast string ke ObjectId secara otomatis.
    const cid = /^[0-9a-fA-F]{24}$/.test(String(companyId)) ? new mongoose.Types.ObjectId(companyId) : companyId;
    const agg = await UsageRecord.aggregate([
        { $match: { companyId: cid, featureSlug, period } },
        { $group: { _id: null, total: { $sum: "$quantity" } } }
    ]);
    return agg[0]?.total || 0;
}

/**
 * Manual override entitlement (permission khusus + reason wajib + expiry).
 * M6-FIX: mendukung `price` — set harga override per fitur per perusahaan
 * (integer minor units). price null/undefined → hapus override (pakai katalog).
 * @param {object} params
 * @param {string} params.companyId
 * @param {string} params.featureSlug
 * @param {boolean} [params.enabled]
 * @param {number|null} [params.limit=null]
 * @param {number|null} [params.price=undefined] Harga override (minor units)
 * @param {string} params.reason
 * @param {string|null} [params.effectiveUntil=null]
 * @param {string} [params.actor=""]
 */
export async function setManualOverride({ companyId, featureSlug, enabled, limit = null, price = undefined, reason, effectiveUntil = null, actor = "" }) {
    if (!reason || !String(reason).trim()) {
        throw new Error("Reason wajib untuk manual override entitlement");
    }
    const feature = await Feature.findOne({ slug: featureSlug }).lean();
    if (!feature) throw new Error(`Feature ${featureSlug} tidak dikenal`);

    const existing = await Entitlement.findOne({ companyId, featureSlug });
    const data = {
        companyId,
        featureId: feature._id,
        featureSlug,
        enabled,
        limit: limit != null ? Math.trunc(Number(limit)) : null,
        source: "MANUAL",
        reason: String(reason).trim(),
        effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
        updatedBy: actor
    };
    // Harga: undefined = jangan sentuh; null/0 = hapus override (pakai katalog).
    if (price !== undefined) {
        data.price = price == null || Number(price) <= 0 ? null : Math.trunc(Number(price));
    }
    if (existing) {
        Object.assign(existing, data);
        await existing.save();
        return existing;
    }
    return Entitlement.create(data);
}

function currentPeriod() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default {
    syncEntitlementsFromSubscription,
    canUse,
    recordUsage,
    setManualOverride,
    getUsed,
    check,
    getUsageStatus,
    computeForCompany
};
