/**
 * Subscriptions API Routes (SP-029 M6 §13-15, §35, §50-51).
 *
 * Lifecycle tervalidasi (state machine) — bukan arbitrary status update.
 * Setiap perubahan subscription otomatis sync entitlement (EntitlementService)
 * dan dicatat ke SubscriptionChange + audit.
 *
 * Endpoint:
 *   GET    /api/subscriptions
 *   GET    /api/subscriptions/:id
 *   GET    /api/subscriptions/:id/changes
 *   POST   /api/subscriptions                     — create (dengan trial)
 *   POST   /api/subscriptions/:id/activate
 *   POST   /api/subscriptions/:id/renew
 *   POST   /api/subscriptions/:id/change-plan     — upgrade/downgrade
 *   POST   /api/subscriptions/:id/suspend
 *   POST   /api/subscriptions/:id/resume
 *   POST   /api/subscriptions/:id/cancel
 *   POST   /api/subscriptions/:id/expire
 *
 * @module console/server/routes/subscriptions
 */

import { Router } from "express";
import mongoose from "mongoose";
import { Subscription } from "../models/Subscription.js";
import { SubscriptionChange } from "../models/SubscriptionChange.js";
import { Plan } from "../models/Plan.js";
import { Company } from "../models/Company.js";
import { security, audit } from "../security.js";
import { canTransition, addBillingCycle } from "../billing/billing-core.js";
import { syncEntitlementsFromSubscription } from "../billing/entitlement-service.js";

const router = Router();
router.use(security.authenticate, security.requireSuperAdmin);

/** Catat perubahan + audit + sync entitlement (helper terpusat). */
async function recordChange({ sub, changeType, oldStatus = "", newStatus = "", oldPlanId = null, newPlanId = null, reason = "", proration = "none", actorName = "", actorId = "" }) {
    await SubscriptionChange.create({
        subscriptionId: sub._id,
        companyId: sub.companyId,
        changeType,
        oldPlanId,
        newPlanId,
        oldStatus,
        newStatus,
        effectiveDate: new Date(),
        proration,
        reason,
        createdBy: actorName
    });
    await syncEntitlementsFromSubscription({ companyId: String(sub.companyId), subscription: sub, actor: actorName, reason: reason || changeType });

    const company = await Company.findById(sub.companyId).select("code name").lean();
    audit.superadminActivity({
        actorId, actorName,
        action: `subscription.${changeType}`,
        targetType: "subscription",
        targetId: String(sub._id),
        targetName: company?.name || "",
        metadata: { companyCode: company?.code || "", status: sub.status, reason },
        ip: "", userAgent: ""
    });
}

router.get("/", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const query = {};
        if (req.query.status) query.status = req.query.status;
        if (req.query.companyId) query.companyId = req.query.companyId;
        const total = await Subscription.countDocuments(query);
        const data = await Subscription.find(query)
            .populate("companyId", "code name active")
            .populate("planId", "slug name")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit).limit(limit).lean();
        res.json({ data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const item = await Subscription.findById(req.params.id)
            .populate("companyId", "code name active")
            .populate("planId", "slug name")
            .lean();
        if (!item) return res.status(404).json({ error: "Subscription tidak ditemukan" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id/changes", async (req, res) => {
    try {
        const data = await SubscriptionChange.find({ subscriptionId: req.params.id })
            .populate("oldPlanId", "slug name").populate("newPlanId", "slug name")
            .sort({ createdAt: -1 }).lean();
        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/subscriptions — buat subscription baru (default TRIAL).
 */
router.post("/", async (req, res) => {
    try {
        const { companyId, planId, status = "TRIAL", startDate, endDate, billingCycle = "MONTHLY", trialDays = 0, autoRenew = true, notes = "" } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(companyId) || !mongoose.Types.ObjectId.isValid(planId)) {
            return res.status(400).json({ error: "companyId dan planId wajib valid" });
        }
        const company = await Company.findById(companyId);
        if (!company) return res.status(404).json({ error: "Company tidak ditemukan" });
        const plan = await Plan.findById(planId);
        if (!plan) return res.status(404).json({ error: "Plan tidak ditemukan" });
        if (plan.status === "inactive") return res.status(400).json({ error: "Plan tidak aktif" });

        if (!["TRIAL", "ACTIVE"].includes(status)) {
            return res.status(400).json({ error: "Status awal hanya TRIAL atau ACTIVE" });
        }

        const now = new Date();
        const start = startDate ? new Date(startDate) : now;
        const trialEnd = trialDays > 0 ? new Date(start.getTime() + trialDays * 86400000) : (status === "TRIAL" ? new Date(start.getTime() + 14 * 86400000) : null);
        const end = endDate ? new Date(endDate) : null;

        const sub = await Subscription.create({
            companyId: company._id,
            planId: plan._id,
            status,
            startDate: start,
            endDate: end || (status === "ACTIVE" ? (trialEnd ? new Date(trialEnd.getTime() + 30 * 86400000) : new Date(start.getTime() + 30 * 86400000)) : trialEnd),
            billingCycle,
            price: plan.price,
            currency: plan.currency || "IDR",
            autoRenew,
            trialStart: status === "TRIAL" ? start : null,
            trialEnd: status === "TRIAL" ? trialEnd : null,
            notes,
            createdBy: req.user.name || ""
        });

        await recordChange({
            sub, changeType: "create", oldStatus: "", newStatus: sub.status,
            reason: notes || "initial subscription", actorName: req.user.name || "Super Admin", actorId: req.user.id
        });
        res.status(201).json(sub);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** Helper: muat sub + validasi transisi. */
async function loadSubAndCheck(req, res, toStatus) {
    const sub = await Subscription.findById(req.params.id);
    if (!sub) { res.status(404).json({ error: "Subscription tidak ditemukan" }); return null; }
    const t = canTransition(sub.status, toStatus);
    if (!t.ok) { res.status(400).json({ error: t.error }); return null; }
    return sub;
}

router.post("/:id/activate", async (req, res) => {
    try {
        const sub = await loadSubAndCheck(req, res, "ACTIVE");
        if (!sub) return;
        const oldStatus = sub.status;
        sub.status = "ACTIVE";
        if (!sub.startDate) sub.startDate = new Date();
        if (!sub.endDate) sub.endDate = new Date(sub.startDate.getTime() + 30 * 86400000);
        if (sub.status === "ACTIVE" && sub.trialEnd) { sub.trialEnd = null; sub.trialStart = null; }
        await sub.save();
        await recordChange({ sub, changeType: oldStatus === "TRIAL" ? "trial_to_active" : "activate", oldStatus, newStatus: "ACTIVE", reason: req.body?.reason || "", actorName: req.user.name, actorId: req.user.id });
        res.json(sub);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/renew", async (req, res) => {
    try {
        const sub = await Subscription.findById(req.params.id);
        if (!sub) return res.status(404).json({ error: "Subscription tidak ditemukan" });
        if (!["ACTIVE", "PAST_DUE"].includes(sub.status)) {
            return res.status(400).json({ error: `Hanya subscription ${["ACTIVE", "PAST_DUE"].join("/")} yang bisa diperpanjang` });
        }
        const oldStatus = sub.status;
        const now = new Date();
        const base = sub.endDate && sub.endDate > now ? sub.endDate : now;
        sub.endDate = addBillingCycle(base, sub.billingCycle);
        sub.status = "ACTIVE";
        await sub.save();
        await recordChange({ sub, changeType: "renew", oldStatus, newStatus: "ACTIVE", reason: req.body?.reason || "renewal", actorName: req.user.name, actorId: req.user.id });
        res.json(sub);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/** POST /:id/change-plan — upgrade/downgrade (bukan sekadar ganti planId). */
router.post("/:id/change-plan", async (req, res) => {
    try {
        const { planId, reason = "" } = req.body || {};
        if (!mongoose.Types.ObjectId.isValid(planId)) return res.status(400).json({ error: "planId wajib valid" });
        const sub = await Subscription.findById(req.params.id);
        if (!sub) return res.status(404).json({ error: "Subscription tidak ditemukan" });
        if (!["ACTIVE", "PAST_DUE", "TRIAL"].includes(sub.status)) {
            return res.status(400).json({ error: `Subscription ${sub.status} tidak bisa ganti plan` });
        }
        const newPlan = await Plan.findById(planId);
        if (!newPlan) return res.status(404).json({ error: "Plan tidak ditemukan" });
        if (String(sub.planId) === String(newPlan._id)) return res.status(400).json({ error: "Plan sudah sama" });

        const oldPlanId = sub.planId;
        const changeType = newPlan.price > (await Plan.findById(oldPlanId).select("price").lean())?.price ? "upgrade" : "downgrade";
        sub.planId = newPlan._id;
        sub.price = newPlan.price;
        sub.currency = newPlan.currency || "IDR";
        await sub.save();
        await recordChange({ sub, changeType, oldStatus: sub.status, newStatus: sub.status, oldPlanId, newPlanId: newPlan._id, reason, proration: "none", actorName: req.user.name, actorId: req.user.id });
        res.json(sub);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/suspend", async (req, res) => {
    try {
        const sub = await loadSubAndCheck(req, res, "SUSPENDED");
        if (!sub) return;
        const oldStatus = sub.status;
        sub.status = "SUSPENDED";
        await sub.save();
        await recordChange({ sub, changeType: "suspend", oldStatus, newStatus: "SUSPENDED", reason: req.body?.reason || "suspended", actorName: req.user.name, actorId: req.user.id });
        res.json(sub);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/resume", async (req, res) => {
    try {
        const sub = await loadSubAndCheck(req, res, "ACTIVE");
        if (!sub) return;
        const oldStatus = sub.status;
        sub.status = "ACTIVE";
        await sub.save();
        await recordChange({ sub, changeType: "resume", oldStatus, newStatus: "ACTIVE", reason: req.body?.reason || "resumed", actorName: req.user.name, actorId: req.user.id });
        res.json(sub);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/** POST /:id/cancel — cancel immediate (default) atau at period end. */
router.post("/:id/cancel", async (req, res) => {
    try {
        const sub = await loadSubAndCheck(req, res, "CANCELLED");
        if (!sub) return;
        const { reason = "", cancelAtPeriodEnd = false } = req.body || {};
        const oldStatus = sub.status;
        if (cancelAtPeriodEnd) {
            // Cancel at period end: entitlement tetap sampai endDate; tandai akan cancel.
            sub.cancelReason = reason;
            sub.cancelledBy = req.user.name || "";
            sub.cancelEffectiveDate = sub.endDate || new Date();
            await sub.save();
            // Catat intent (status tetap ACTIVE sampai endDate)
            await recordChange({ sub, changeType: "cancel", oldStatus, newStatus: oldStatus, reason: `cancel at period end: ${reason}`, actorName: req.user.name, actorId: req.user.id });
            return res.json({ ...sub.toObject(), cancelScheduled: true });
        }
        sub.status = "CANCELLED";
        sub.cancelledAt = new Date();
        sub.cancelledBy = req.user.name || "";
        sub.cancelReason = reason;
        sub.cancelEffectiveDate = new Date();
        await sub.save();
        await recordChange({ sub, changeType: "cancel", oldStatus, newStatus: "CANCELLED", reason, actorName: req.user.name, actorId: req.user.id });
        res.json(sub);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/expire", async (req, res) => {
    try {
        const sub = await loadSubAndCheck(req, res, "EXPIRED");
        if (!sub) return;
        const oldStatus = sub.status;
        sub.status = "EXPIRED";
        await sub.save();
        await recordChange({ sub, changeType: "expire", oldStatus, newStatus: "EXPIRED", reason: req.body?.reason || "expired", actorName: req.user.name, actorId: req.user.id });
        res.json(sub);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
