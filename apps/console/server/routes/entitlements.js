/**
 * SP-029 M6 — Entitlements API.
 * Super Admin: view + manual override (reason wajib, audit, expiry).
 * Internal: entitlement check untuk aplikasi (controlled).
 */
import { Router } from "express";
import mongoose from "mongoose";
import { security, audit } from "../security.js";
import { Entitlement } from "../models/Entitlement.js";
import { Feature } from "../models/Feature.js";
import { check as checkEntitlement, computeForCompany, setManualOverride } from "../billing/entitlement-service.js";

const router = Router();

// ⚠️ Endpoint SERVICE CHECK didaftarkan SEBELUM router.use(authenticate):
// dipanggil oleh aplikasi SMART Platform (Inventory dst) dengan service key
// (header x-entitlement-key), bukan JWT superadmin — fail-closed (401 bila
// key tidak diset / salah). M6 §31: aplikasi → SMART API → Entitlement Service.
const SERVICE_KEY = process.env.BILLING_SERVICE_KEY || "";

/**
 * GET /api/entitlements/service/check/:companyCode/:featureSlug
 * Entitlement check untuk APLIKASI. Wajib header `x-entitlement-key`.
 * Tidak mengembalikan detail billing — hanya { enabled, limit, used, remaining }.
 */
router.get("/service/check/:companyCode/:featureSlug", async (req, res) => {
    const received = req.headers["x-entitlement-key"];
    if (!SERVICE_KEY || received !== SERVICE_KEY) {
        return res.status(401).json({ error: "invalid entitlement service key" });
    }
    try {
        const { companyCode, featureSlug } = req.params;
        if (!/^[a-zA-Z0-9-_.]+$/.test(companyCode) || !/^[a-zA-Z0-9-_]+$/.test(featureSlug)) {
            return res.status(400).json({ error: "parameter tidak valid" });
        }
        const result = await checkEntitlement(companyCode, featureSlug);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.use(security.authenticate, security.requireSuperAdmin);

function parseBool(v) {
    if (v === true || v === "true" || v === 1 || v === "1") return true;
    if (v === false || v === "false" || v === 0 || v === "0") return false;
    return null;
}

/** GET /api/entitlements?companyId=&featureId=&source= */
router.get("/", security.authenticate, security.requireSuperAdmin, async (req, res) => {
    try {
        const { companyId, featureId, source } = req.query;
        const filter = {};
        if (companyId) filter.companyId = companyId;
        if (featureId) filter.featureId = featureId;
        if (source) filter.source = source;

        const items = await Entitlement.find(filter)
            .populate("featureId", "slug name price")
            .sort({ companyId: 1, featureId: 1 })
            .limit(500);
        res.json({ data: items, total: items.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** GET /api/entitlements/check/:companyCode/:featureSlug — internal check API untuk aplikasi */
router.get("/check/:companyCode/:featureSlug", async (req, res) => {
    try {
        const { companyCode, featureSlug } = req.params;
        const result = await checkEntitlement(companyCode, featureSlug);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** GET /api/entitlements/company/:companyId — komputasi entitlement lengkap satu company */
router.get("/company/:companyId", async (req, res) => {
    try {
        const result = await computeForCompany(req.params.companyId);
        res.json({ data: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST /api/entitlements/price — set harga per fitur per perusahaan (M6-FIX).
 * Semantik price: null/"" = reset (pakai katalog); 0 = eksplisit GRATIS;
 * >0 = harga override (integer minor units). Alasan disimpan di priceReason
 * (tidak menimpa reason — marker legacy grandfathering tetap utuh).
 */
router.post("/price", async (req, res) => {
    try {
        const { companyId, featureId, price, reason } = req.body;

        if (!companyId || !featureId) return res.status(400).json({ error: "companyId dan featureId wajib" });
        if (!reason || String(reason).trim().length < 5) {
            return res.status(400).json({ error: "Alasan (reason) wajib minimal 5 karakter" });
        }

        let feature = null;
        if (mongoose.Types.ObjectId.isValid(String(featureId))) {
            feature = await Feature.findById(featureId).lean();
        }
        if (!feature) {
            feature = await Feature.findOne({ slug: String(featureId).toLowerCase() }).lean();
        }
        if (!feature) return res.status(404).json({ error: "Feature tidak ditemukan" });

        // null/kosong = reset ke katalog; 0 = gratis; >0 = override.
        const priceNum = price === null || price === undefined || price === ""
            ? null
            : Math.trunc(Number(price));
        if (priceNum !== null && (!Number.isFinite(priceNum) || priceNum < 0)) {
            return res.status(400).json({ error: "price harus angka >= 0 (minor units)" });
        }

        let ent = await Entitlement.findOne({ companyId, featureSlug: feature.slug });
        if (!ent) {
            // Company baru tanpa subscription: auto-create entitlement agar
            // flow "Invoice by Company" langsung jalan (M6-FIX).
            ent = await Entitlement.create({
                companyId,
                featureId: feature._id,
                featureSlug: feature.slug,
                enabled: true,
                source: "PLAN",
                reason: "auto-created saat set harga (M6-FIX)",
                createdBy: req.user.name || "Super Admin"
            });
        }

        ent.price = priceNum; // null = katalog, 0 = gratis, >0 = override
        ent.priceReason = String(reason).trim();
        ent.updatedBy = req.user.name || "Super Admin";
        await ent.save();

        audit.superadminActivity({
            actorId: req.user.id, actorName: req.user.name,
            action: "entitlement.price_set", targetType: "entitlement", targetId: `${companyId}:${feature.slug}`, targetName: feature.name,
            metadata: { companyId, featureId: feature.slug, price: ent.price ?? feature.price ?? 0, reason },
            ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
        });
        res.json({ data: { ...ent.toObject(), defaultPrice: feature.price ?? 0 } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST /api/entitlements — manual override (permission + reason wajib + audit + expiry) */
router.post("/", async (req, res) => {
    try {
        const { companyId, featureId, enabled, limit, reason, effectiveUntil } = req.body;

        if (!companyId || !featureId) return res.status(400).json({ error: "companyId dan featureId wajib" });
        if (!reason || String(reason).trim().length < 5) {
            return res.status(400).json({ error: "Alasan (reason) wajib minimal 5 karakter" });
        }
        // Terima ObjectId ATAU slug (UI bisa kirim fallback slug) — anti CastError.
        let feature = null;
        if (mongoose.Types.ObjectId.isValid(String(featureId))) {
            feature = await Feature.findById(featureId).lean();
        }
        if (!feature) {
            feature = await Feature.findOne({ slug: String(featureId).toLowerCase() }).lean();
        }
        if (!feature) return res.status(404).json({ error: "Feature tidak ditemukan" });

        const enabledVal = parseBool(enabled);
        if (enabledVal === null) return res.status(400).json({ error: "enabled harus boolean" });

        const payload = {
            companyId,
            featureSlug: feature.slug,
            enabled: enabledVal,
            reason,
            actor: req.user.name || "Super Admin"
        };
        if (limit !== undefined && limit !== null && limit !== "") {
            const n = Number(limit);
            if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: "limit harus angka >= 0" });
            payload.limit = n;
        }
        if (effectiveUntil) payload.effectiveUntil = new Date(effectiveUntil);

        const override = await setManualOverride(payload);
        audit.superadminActivity({
            actorId: req.user.id, actorName: req.user.name,
            action: "entitlement.override", targetType: "entitlement", targetId: `${companyId}:${feature.slug}`, targetName: feature.name,
            metadata: { companyId, featureId: feature.slug, enabled: enabledVal, limit: payload.limit ?? null, reason },
            ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
        });
        res.status(201).json({ data: override });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
