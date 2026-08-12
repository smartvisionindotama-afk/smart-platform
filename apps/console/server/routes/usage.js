/**
 * Usage API Routes (SP-029 M6 §28-29, §38, §53).
 *
 * Usage metering foundation — record + aggregasi per periode.
 * Usage HANYA dari sumber trusted (server/worker/app-service),
 * tidak menerima usage dari browser secara bebas (source wajib).
 *
 * Endpoint:
 *   GET    /api/usage                 — list + filter
 *   GET    /api/usage/aggregate?companyId=&featureId=&period=
 *   POST   /api/usage                 — record (source wajib, whitelist)
 *
 * @module console/server/routes/usage
 */

import { Router } from "express";
import { security, audit } from "../security.js";
import { UsageRecord } from "../models/UsageRecord.js";
import { getUsageStatus, recordUsage as serviceRecordUsage } from "../billing/entitlement-service.js";
import { periodKey } from "../billing/billing-core.js";

const router = Router();
router.use(security.authenticate, security.requireSuperAdmin);

/** Source yang diperbolehkan — usage tidak boleh berasal dari browser bebas. */
export const ALLOWED_USAGE_SOURCES = ["APPLICATION", "API", "WORKER", "AI", "MANUAL"];

export function normalizeUsagePayload(data = {}) {
    const errors = [];
    if (!data.companyId) errors.push("companyId wajib");
    if (!data.featureId) errors.push("featureId wajib");
    if (!data.metric) errors.push("metric wajib (contoh: transactions, users, ai_tokens)");
    const qty = Number(data.quantity);
    if (Number.isNaN(qty) || qty < 0) errors.push("quantity wajib angka >= 0");
    if (!data.source || !ALLOWED_USAGE_SOURCES.includes(String(data.source).toUpperCase())) {
        errors.push(`source wajib salah satu: ${ALLOWED_USAGE_SOURCES.join(", ")}`);
    }
    return errors;
}

router.get("/", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const filter = {};
        if (req.query.companyId) filter.companyId = req.query.companyId;
        if (req.query.featureId) filter.featureId = req.query.featureId;
        if (req.query.period) filter.period = req.query.period;
        if (req.query.source) filter.source = String(req.query.source).toUpperCase();
        const total = await UsageRecord.countDocuments(filter);
        const data = await UsageRecord.find(filter)
            .sort({ recordedAt: -1 })
            .skip((page - 1) * limit).limit(limit).lean();
        res.json({ data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** GET /api/usage/aggregate — total usage per company+feature+period (untuk UI entitlement). */
router.get("/aggregate", async (req, res) => {
    try {
        const { companyId, featureId, period } = req.query;
        const match = {};
        if (companyId) match.companyId = companyId;
        if (featureId) match.featureId = featureId;
        if (period) match.period = period;
        const rows = await UsageRecord.aggregate([
            { $match: match },
            { $group: { _id: { companyId: "$companyId", featureId: "$featureId", period: "$period" }, total: { $sum: "$quantity" }, records: { $sum: 1 } } },
            { $sort: { "_id.period": -1 } },
            { $limit: 200 }
        ]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST /api/usage — record usage (source trusted, whitelist). */
router.post("/", async (req, res) => {
    try {
        const data = req.body || {};
        const errors = normalizeUsagePayload(data);
        if (errors.length) return res.status(400).json({ error: errors.join("; ") });

        // Catat via EntitlementService.recordUsage — resolve feature, buat
        // UsageRecord, DAN update snapshot `used` di Entitlement (konsisten
        // dengan tab Entitlements di UI).
        const record = await serviceRecordUsage({
            companyId: data.companyId,
            featureSlug: String(data.featureId), // service resolve slug ATAU ObjectId
            metric: String(data.metric).trim(),
            quantity: Math.trunc(Number(data.quantity)),
            period: data.period || periodKey(new Date()),
            source: String(data.source).toUpperCase(),
            actor: req.user.name || "system",
            notes: String(data.notes || "")
        });

        audit.superadminActivity({
            actorId: req.user.id, actorName: req.user.name,
            action: "usage.record", targetType: "usage", targetId: String(record._id),
            targetName: `${data.companyId}:${data.featureId}`,
            metadata: { metric: record.metric, quantity: record.quantity, period: record.period, source: record.source },
            ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
        });
        res.status(201).json(record);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** GET /api/usage/status/:companyId/:featureId — entitlement + usage (limit/used/remaining). */
router.get("/status/:companyId/:featureId", async (req, res) => {
    try {
        const { companyId, featureId } = req.params;
        const result = await getUsageStatus(companyId, featureId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
