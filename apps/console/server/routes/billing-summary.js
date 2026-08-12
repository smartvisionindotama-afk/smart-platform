/**
 * Billing Summary API (SP-029 M6-FIX — Task 2: Billing Detail per company).
 *
 * Endpoint agregat untuk halaman Companies: satu request → subscription aktif,
 * plan, features checklist (enabled/limit/used/remaining), dan usage.
 *
 * Endpoint:
 *   GET /api/billing/company/:companyId — ringkasan billing satu company
 *
 * Proteksi: authenticate + requireSuperAdmin (M3). Semua data server-side.
 *
 * @module console/server/routes/billing-summary
 */

import { Router } from "express";
import mongoose from "mongoose";
import { security } from "../security.js";
import { Subscription } from "../models/Subscription.js";
import { SubscriptionChange } from "../models/SubscriptionChange.js";
import { Plan } from "../models/Plan.js";
import { Company } from "../models/Company.js";
import { computeForCompany } from "../billing/entitlement-service.js";

const router = Router();
router.use(security.authenticate, security.requireSuperAdmin);

/**
 * GET /api/billing/company/:companyId
 * Ringkasan komersial company: subscription terbaru + riwayat, plan,
 * entitlement/features dengan usage, dan MRR kontribusi.
 */
router.get("/company/:companyId", async (req, res) => {
    try {
        const { companyId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            return res.status(400).json({ error: "companyId tidak valid" });
        }

        const company = await Company.findById(companyId).select("code name active").lean();
        if (!company) return res.status(404).json({ error: "Company tidak ditemukan" });

        // Subscription terbaru + seluruh riwayat perubahan
        const subscription = await Subscription.findOne({ companyId })
            .populate("planId", "slug name price billingCycle currency features limits")
            .sort({ createdAt: -1 })
            .lean();

        const changes = subscription
            ? await SubscriptionChange.find({ subscriptionId: subscription._id })
                .populate("oldPlanId", "slug name")
                .populate("newPlanId", "slug name")
                .sort({ createdAt: -1 })
                .limit(10)
                .lean()
            : [];

        // Entitlement + usage per feature (limit/used/remaining)
        const entitlements = await computeForCompany(companyId);

        // Feature catalog — M6-FIX: tampilkan SELURUH entitlement company
        // (termasuk override manual), bukan hanya plan.features — sehingga
        // company tanpa subscription (grandfathering) tetap terlihat fiturnya.
        const plan = subscription?.planId || null;
        const planSlugs = new Set(plan?.features || []);
        const seen = new Set();
        const features = entitlements.map(ent => {
            seen.add(ent.featureSlug);
            return {
                slug: ent.featureSlug,
                name: ent.featureName || ent.featureSlug,
                enabled: ent.enabled,
                limit: ent.limit ?? null,
                used: ent.used ?? 0,
                remaining: ent.remaining ?? null,
                source: ent.source || "PLAN",
                inPlan: planSlugs.has(ent.featureSlug),
                price: ent.price ?? null,
                defaultPrice: ent.defaultPrice ?? 0
            };
        });
        // Fitur plan yang belum punya entitlement (normalisasi defensif)
        for (const slug of planSlugs) {
            if (!seen.has(slug)) {
                features.push({ slug, name: slug, enabled: true, limit: null, used: 0, remaining: null, source: "PLAN", inPlan: true, price: null, defaultPrice: 0 });
            }
        }

        // MRR kontribusi company ini (hanya ACTIVE)
        let mrr = 0;
        let arr = 0;
        if (subscription?.status === "ACTIVE") {
            const price = Number(subscription.price) || 0;
            if (subscription.billingCycle === "YEARLY") { arr += price; mrr += Math.round(price / 12); }
            else if (subscription.billingCycle === "MONTHLY") { mrr += price; arr += price * 12; }
        }

        res.json({
            data: {
                company: { id: company._id, code: company.code, name: company.name, active: company.active },
                subscription: subscription
                    ? {
                        id: subscription._id,
                        status: subscription.status,
                        planId: subscription.planId?._id || null,
                        planName: plan?.name || "",
                        planSlug: plan?.slug || "",
                        planPrice: plan?.price ?? subscription.price,
                        billingCycle: subscription.billingCycle,
                        price: subscription.price,
                        currency: subscription.currency,
                        startDate: subscription.startDate,
                        endDate: subscription.endDate,
                        autoRenew: subscription.autoRenew,
                        trialEnd: subscription.trialEnd,
                        cancelReason: subscription.cancelReason,
                        cancelledAt: subscription.cancelledAt
                    }
                    : null,
                changes,
                features,
                mrr,
                arr
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
