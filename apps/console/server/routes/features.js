/**
 * Features API Routes (SP-029 M6 §9-10, §53).
 *
 * Feature catalog — configuration, bukan hardcode di aplikasi.
 *
 * Endpoint:
 *   GET    /api/features
 *   GET    /api/features/:id
 *   POST   /api/features
 *   PUT    /api/features/:id
 *
 * @module console/server/routes/features
 */

import { Router } from "express";
import { Feature } from "../models/Feature.js";
import { Entitlement } from "../models/Entitlement.js";
import { security, audit } from "../security.js";

const router = Router();
router.use(security.authenticate, security.requireSuperAdmin);

export function normalizeFeatureSlug(slug) {
    return String(slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function validateFeaturePayload(data = {}) {
    const errors = [];
    if (!data.name || !String(data.name).trim()) errors.push("Nama feature wajib diisi");
    if (!data.slug) errors.push("Slug feature wajib diisi");
    if (data.price !== undefined && data.price !== null && data.price !== "") {
        const p = Number(data.price);
        if (!Number.isFinite(p) || p < 0 || !Number.isInteger(p)) {
            errors.push("Harga (price) harus integer >= 0 (minor units)");
        }
    }
    return errors;
}

/**
 * Normalisasi price katalog: null/"" → default 0; else integer >= 0.
 * @param {*} price
 * @returns {number}
 */
export function normalizeFeaturePrice(price) {
    if (price === undefined || price === null || price === "") return 0;
    const n = Math.trunc(Number(price));
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

router.get("/", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const query = {};
        if (req.query.status) query.status = req.query.status;
        if (req.query.category) query.category = req.query.category;
        const total = await Feature.countDocuments(query);
        const data = await Feature.find(query).sort({ sortOrder: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean();

        // M6-FIX: jumlah company yang meng-override harga fitur ini
        // (Entitlement.price != null) — indikator harga efektif di UI.
        const overrides = await Entitlement.aggregate([
            { $match: { price: { $ne: null } } },
            { $group: { _id: "$featureSlug", count: { $sum: 1 } } }
        ]);
        const overrideMap = new Map(overrides.map(o => [o._id, o.count]));
        const enriched = data.map(f => ({ ...f, overrideCount: overrideMap.get(f.slug) || 0 }));

        res.json({ data: enriched, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const item = await Feature.findById(req.params.id).lean();
        if (!item) return res.status(404).json({ error: "Feature tidak ditemukan" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const data = req.body || {};
        const errors = validateFeaturePayload(data);
        if (errors.length) return res.status(400).json({ error: errors.join("; ") });

        const slug = normalizeFeatureSlug(data.slug);
        const existing = await Feature.findOne({ slug });
        if (existing) return res.status(409).json({ error: `Slug feature "${slug}" sudah digunakan` });

        const feature = await Feature.create({
            slug,
            name: String(data.name).trim(),
            description: String(data.description || "").trim(),
            category: String(data.category || "general").trim(),
            unit: String(data.unit || "FEATURE").trim().toUpperCase(),
            price: normalizeFeaturePrice(data.price),
            status: data.status === "inactive" ? "inactive" : "active",
            sortOrder: Number(data.sortOrder) || 0,
            createdBy: req.user.id || null
        });

        audit.superadminActivity({
            actorId: req.user.id, actorName: req.user.name,
            action: "feature.create", targetType: "feature", targetId: feature.slug, targetName: feature.name,
            ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
        });
        res.status(201).json(feature);
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: "Slug feature sudah digunakan" });
        res.status(500).json({ error: err.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const feature = await Feature.findById(req.params.id);
        if (!feature) return res.status(404).json({ error: "Feature tidak ditemukan" });
        const data = req.body || {};
        if (data.name !== undefined && !String(data.name).trim()) {
            return res.status(400).json({ error: "Nama feature wajib diisi" });
        }
        const fields = ["name", "description", "category", "unit", "status", "sortOrder"];
        for (const f of fields) {
            if (data[f] !== undefined) feature[f] = data[f];
        }
        // Harga katalog (integer minor units) — validasi & normalisasi.
        if (data.price !== undefined) {
            const p = Number(data.price);
            if (!Number.isFinite(p) || p < 0 || !Number.isInteger(p)) {
                return res.status(400).json({ error: "Harga (price) harus integer >= 0 (minor units)" });
            }
            feature.price = p;
        }
        feature.updatedBy = req.user.id || null;
        const saved = await feature.save();

        audit.superadminActivity({
            actorId: req.user.id, actorName: req.user.name,
            action: "feature.update", targetType: "feature", targetId: saved.slug, targetName: saved.name,
            ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
        });
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
