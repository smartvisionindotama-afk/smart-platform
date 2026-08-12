/**
 * Plans API Routes (SP-029 M6 §8, §53).
 *
 * Plan adalah configuration/domain data — bukan hardcode frontend.
 * Proteksi: authenticate + requireSuperAdmin (M3). Harga integer minor units.
 *
 * Endpoint:
 *   GET    /api/plans
 *   GET    /api/plans/:id
 *   POST   /api/plans
 *   PUT    /api/plans/:id
 *
 * @module console/server/routes/plans
 */

import { Router } from "express";
import { Plan } from "../models/Plan.js";
import { security, audit } from "../security.js";

const router = Router();
router.use(security.authenticate, security.requireSuperAdmin);

/** Validasi slug plan (pure — testable). */
export function normalizePlanSlug(slug) {
    return String(slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** Validasi payload plan — daftar error. */
export function validatePlanPayload(data = {}) {
    const errors = [];
    if (!data.name || !String(data.name).trim()) errors.push("Nama plan wajib diisi");
    if (!data.slug) errors.push("Slug plan wajib diisi");
    const price = Number(data.price);
    if (data.price === undefined || Number.isNaN(price) || price < 0) {
        errors.push("Harga wajib angka >= 0 (integer minor units)");
    } else if (!Number.isInteger(price)) {
        errors.push("Harga harus integer (minor units) — tidak boleh desimal");
    }
    if (data.billingCycle && !["MONTHLY", "YEARLY", "CUSTOM"].includes(data.billingCycle)) {
        errors.push("billingCycle harus MONTHLY/YEARLY/CUSTOM");
    }
    return errors;
}

router.get("/", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const query = {};
        if (req.query.status) query.status = req.query.status;
        const total = await Plan.countDocuments(query);
        const data = await Plan.find(query).sort({ sortOrder: 1, createdAt: 1 }).skip((page - 1) * limit).limit(limit).lean();
        res.json({ data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const item = await Plan.findById(req.params.id).lean();
        if (!item) return res.status(404).json({ error: "Plan tidak ditemukan" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const data = req.body || {};
        const errors = validatePlanPayload(data);
        if (errors.length) return res.status(400).json({ error: errors.join("; ") });

        const slug = normalizePlanSlug(data.slug);
        const existing = await Plan.findOne({ slug });
        if (existing) return res.status(409).json({ error: `Slug plan "${slug}" sudah digunakan` });

        const plan = await Plan.create({
            slug,
            name: String(data.name).trim(),
            description: String(data.description || "").trim(),
            billingCycle: data.billingCycle || "MONTHLY",
            price: Math.trunc(Number(data.price)),
            currency: data.currency || "IDR",
            features: Array.isArray(data.features) ? data.features.filter(Boolean) : [],
            limits: data.limits && typeof data.limits === "object" ? data.limits : {},
            status: data.status === "inactive" ? "inactive" : "active",
            sortOrder: Number(data.sortOrder) || 0,
            createdBy: req.user.id || null
        });

        audit.superadminActivity({
            actorId: req.user.id, actorName: req.user.name,
            action: "plan.create", targetType: "plan", targetId: plan.slug, targetName: plan.name,
            metadata: { price: plan.price, billingCycle: plan.billingCycle, features: plan.features.length },
            ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
        });
        res.status(201).json(plan);
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: "Slug plan sudah digunakan" });
        res.status(500).json({ error: err.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) return res.status(404).json({ error: "Plan tidak ditemukan" });
        const data = req.body || {};
        if (data.name !== undefined && !String(data.name).trim()) {
            return res.status(400).json({ error: "Nama plan wajib diisi" });
        }
        if (data.price !== undefined) {
            const price = Number(data.price);
            if (Number.isNaN(price) || price < 0 || !Number.isInteger(price)) {
                return res.status(400).json({ error: "Harga harus integer >= 0 (minor units)" });
            }
            plan.price = Math.trunc(price);
        }
        const fields = ["name", "description", "billingCycle", "currency", "features", "limits", "status", "sortOrder"];
        for (const f of fields) {
            if (data[f] !== undefined) plan[f] = data[f];
        }
        plan.updatedBy = req.user.id || null;
        const saved = await plan.save();

        audit.superadminActivity({
            actorId: req.user.id, actorName: req.user.name,
            action: "plan.update", targetType: "plan", targetId: saved.slug, targetName: saved.name,
            ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
        });
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
