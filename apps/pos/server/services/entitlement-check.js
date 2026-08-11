/**
 * Entitlement Check Service — SMART Kasir Server (M1 clone, M4 [USULAN]).
 *
 * Enforcement entitlement (M6 §55) secara CONTROLLED untuk aplikasi POS.
 * Salinan dari inventory — feature slug diubah ke "pos" (aktivasi POS M2).
 *
 * Arsitektur: POS, Inventory dan Console BERBAGI MongoDB yang sama
 * (smart_inventory). Persis seperti Company.apps, entitlement & subscription
 * dibaca LANGSUNG dari DB bersama — tanpa HTTP dependency ke Console.
 *
 * Mode enforcement via env BILLING_ENFORCEMENT (default: "off"):
 *   off   — tanpa pengecekan (perilaku lama, grandfathering penuh)
 *   flag  — izinkan login, tapi sertakan status entitlement di response
 *           login/impersonate (UI menampilkan banner peringatan)
 *   block — TOLAK login/impersonate bila entitlement fitur "pos"
 *           disabled DAN bukan legacy grandfathering (M6 §55/§56)
 *
 * Grandfathering (M6 §56): company existing yang TIDAK punya subscription sama
 * sekali ATAU entitlement-nya bertanda "legacy grandfathering" TIDAK diblokir —
 * tetap boleh akses (dianggap enabled oleh platform, bukan karena pembayaran).
 *
 * @module pos/server/services/entitlement-check
 */

import mongoose from "mongoose";

/** Feature slug di platform untuk aplikasi POS (aktivasi via Master Platform M2). */
export const POS_FEATURE = "pos";

/** Mode enforcement dari ENV. */
export function enforcementMode() {
    const mode = String(process.env.BILLING_ENFORCEMENT || "off").toLowerCase();
    return ["off", "flag", "block"].includes(mode) ? mode : "off";
}

/**
 * Ambil entitlement + subscription terkini untuk sebuah company.
 * Read-only, langsung dari DB bersama (collection `entitlements` & `subscriptions`).
 * @param {string} companyCode
 * @returns {Promise<object|null>} null jika company tidak ditemukan
 */
async function loadBillingState(companyCode) {
    const db = mongoose.connection.db;
    const company = await db.collection("companies").findOne(
        { code: companyCode },
        { projection: { _id: 1, code: 1, name: 1 } }
    );
    if (!company) return null;

    const entitlements = await db.collection("entitlements").find({ companyId: company._id }).toArray();
    const subs = await db.collection("subscriptions")
        .find({ companyId: company._id })
        .sort({ createdAt: -1 })
        .toArray();

    return { company, entitlements, subscriptions: subs };
}

/**
 * Hitung status entitlement fitur POS untuk company.
 * @param {string} companyCode
 * @returns {Promise<object>} {
 *   enabled, grandfathered, hasSubscription, subscriptionStatus, reason, mode
 * }
 */
export async function computePosEntitlement(companyCode) {
    const state = await loadBillingState(companyCode);
    const mode = enforcementMode();

    if (!state) {
        return { enabled: true, grandfathered: true, hasSubscription: false, subscriptionStatus: null, reason: "company_not_found", mode };
    }

    const ent = state.entitlements.find(e => e.featureSlug === POS_FEATURE);
    const activeSub = state.subscriptions.find(s => ["TRIAL", "ACTIVE", "PAST_DUE"].includes(s.status));
    const latestSub = state.subscriptions[0] || null;

    // Grandfathering: tidak ada subscription sama sekali, ATAU entitlement legacy.
    const legacyMarked = ent && /legacy grandfathering/i.test(String(ent.reason || ""));
    const grandfathered = (!state.subscriptions.length) || Boolean(legacyMarked);

    // Entitlement tidak tercatat → anggap enabled (unknown tidak memblokir).
    if (!ent) {
        return {
            enabled: true,
            grandfathered,
            hasSubscription: Boolean(activeSub),
            subscriptionStatus: latestSub?.status || null,
            reason: grandfathered ? "grandfathered_no_entitlement" : "no_entitlement_record",
            mode
        };
    }

    const base = {
        grandfathered,
        hasSubscription: Boolean(activeSub),
        subscriptionStatus: latestSub?.status || null,
        source: ent.source || "PLAN",
        mode
    };

    // Legacy grandfathering → SELALU boleh akses (M6 §56).
    if (legacyMarked) {
        return { ...base, enabled: true, reason: "grandfathered_legacy" };
    }

    if (ent.enabled) {
        return { ...base, enabled: true, reason: "enabled" };
    }

    // Entitlement disabled eksplisit (bukan legacy):
    // - Tanpa subscription aktif → akses ditolak (block) / diperingatkan (flag).
    // - Ada subscription aktif tapi entitlement disabled → anomali sync → izinkan
    //   dengan warning (jangan salah blokir).
    if (!activeSub) {
        return { ...base, enabled: false, reason: "disabled_no_active_subscription" };
    }
    return { ...base, enabled: false, reason: "disabled_but_subscription_active", warning: true };
}

/**
 * Cek akses saat login/impersonate (terpusat).
 * @param {string} companyCode
 * @returns {Promise<{ allowed: boolean, status: object, httpStatus?: number, error?: string }>}
 */
export async function enforcePosEntitlement(companyCode) {
    const mode = enforcementMode();
    if (mode === "off") {
        return { allowed: true, status: { enabled: true, grandfathered: true, mode } };
    }

    const status = await computePosEntitlement(companyCode);

    if (mode === "flag") {
        // Izinkan selalu; UI menampilkan banner sesuai status.
        return { allowed: true, status };
    }

    // mode === "block"
    if (status.enabled || status.grandfathered) {
        return { allowed: true, status };
    }
    return {
        allowed: false,
        status,
        httpStatus: 403,
        error: "Akses aplikasi POS dinonaktifkan untuk perusahaan ini. Subscription tidak aktif — hubungi Super Admin platform."
    };
}

export default {
    POS_FEATURE,
    enforcementMode,
    computePosEntitlement,
    enforcePosEntitlement
};
