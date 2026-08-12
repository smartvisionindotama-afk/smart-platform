/**
 * Release API Routes — release management (SP-027 M5 §7).
 *
 * BUILD ≠ RELEASE ≠ DEPLOYMENT. Release: { version, commit, artifact }
 * siap di-deploy. Validasi semver ketat; versi unik per aplikasi.
 *
 * Endpoint:
 *   GET  /api/releases?applicationId=&page=&limit=  — list + history
 *   GET  /api/releases/:id                          — detail
 *   POST /api/releases                              — create release
 *   POST /api/releases/:id/promote                  — tandai deployed (manual)
 *
 * @module console/server/routes/releases
 */

import { Router } from "express";
import { ReleaseRecord } from "../models/ReleaseRecord.js";
import { Application } from "../models/Application.js";
import { security, audit } from "../security.js";

const router = Router();

router.use(security.authenticate, security.requireSuperAdmin);

/** Validasi semver vX.Y.Z (fungsi murni — testable). */
export function isValidSemver(version) {
    return /^v?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(String(version || "").trim());
}

/** Normalisasi versi → vX.Y.Z. */
export function normalizeVersion(version) {
    const v = String(version || "").trim();
    return v.startsWith("v") ? v : `v${v}`;
}

/**
 * GET /api/releases — list release (filter aplikasi, pagination).
 */
router.get("/", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const query = {};
        if (req.query.applicationId) query.applicationId = req.query.applicationId;

        const total = await ReleaseRecord.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await ReleaseRecord.find(query)
            .populate("applicationId", "slug name icon")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/releases/:id — detail release.
 */
router.get("/:id", async (req, res) => {
    try {
        const item = await ReleaseRecord.findById(req.params.id)
            .populate("applicationId", "slug name icon")
            .lean();
        if (!item) return res.status(404).json({ error: "Release tidak ditemukan" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/releases — create release untuk aplikasi.
 * Version wajib semver; unik per aplikasi.
 */
router.post("/", async (req, res) => {
    try {
        const { applicationId, version, commit, branch, notes } = req.body || {};
        if (!applicationId) return res.status(400).json({ error: "applicationId wajib diisi" });
        if (!version || !isValidSemver(version)) {
            return res.status(400).json({ error: "Version wajib format semver (mis. 1.0.0 atau v1.0.0)" });
        }

        const app = await Application.findById(applicationId);
        if (!app) return res.status(404).json({ error: "Aplikasi tidak ditemukan" });

        const normalized = normalizeVersion(version);
        const existing = await ReleaseRecord.findOne({ applicationId, version: normalized });
        if (existing) {
            return res.status(409).json({ error: `Release ${normalized} sudah ada untuk aplikasi ini` });
        }

        const item = await ReleaseRecord.create({
            applicationId,
            version: normalized,
            commit: commit || "",
            branch: branch || app.branch || "main",
            notes: notes || "",
            status: "created",
            createdBy: req.user.name || req.user.username || "Super Admin"
        });

        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "release.create",
            targetType: "application",
            targetId: app.slug,
            targetName: app.name,
            metadata: { version: normalized, commit },
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.status(201).json(item);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: "Release versi sudah ada" });
        }
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/releases/:id/promote — tandai release sebagai deployed.
 * (Dipanggil otomatis oleh Deployment Worker saat deploy sukses; endpoint
 * manual untuk kasus di mana deploy dilakukan di luar sistem.)
 */
router.post("/:id/promote", async (req, res) => {
    try {
        const item = await ReleaseRecord.findById(req.params.id);
        if (!item) return res.status(404).json({ error: "Release tidak ditemukan" });
        item.status = "deployed";
        item.deployedAt = new Date();
        await item.save();

        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "release.promote",
            targetType: "application",
            targetId: item.applicationId?.toString() || "",
            targetName: item.version,
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
