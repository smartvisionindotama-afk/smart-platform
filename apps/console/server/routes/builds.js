/**
 * Build API Routes — pipeline build (SP-027 M5 §6).
 *
 * BUILD ≠ RELEASE ≠ DEPLOYMENT. Build mengeksekusi pipeline:
 * source → install → test → build → artifact, via Deployment Worker
 * (queue in-memory). Log disimpan untuk ditelusuri.
 *
 * Endpoint:
 *   GET  /api/builds?applicationId=&status=&page=&limit=  — list + filter
 *   GET  /api/builds/:id                                  — detail + logs
 *   POST /api/builds                                      — trigger build
 *
 * @module console/server/routes/builds
 */

import { Router } from "express";
import mongoose from "mongoose";
import { BuildRecord } from "../models/BuildRecord.js";
import { Application } from "../models/Application.js";
import { security, audit } from "../security.js";
import { enqueue } from "../deployment/queue.js";
import { runCommand, validateCommand, validateCwd } from "../deployment/pipeline.js";
import path from "node:path";

const router = Router();

router.use(security.authenticate, security.requireSuperAdmin);

/**
 * GET /api/builds — list build records (search + filter + pagination).
 */
router.get("/", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const query = {};
        if (req.query.applicationId) query.applicationId = req.query.applicationId;
        if (req.query.status && ["QUEUED", "RUNNING", "SUCCESS", "FAILED", "CANCELLED"].includes(req.query.status)) {
            query.status = req.query.status;
        }

        const total = await BuildRecord.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await BuildRecord.find(query)
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
 * GET /api/builds/:id — detail + log build.
 */
router.get("/:id", async (req, res) => {
    try {
        const item = await BuildRecord.findById(req.params.id)
            .populate("applicationId", "slug name icon")
            .lean();
        if (!item) return res.status(404).json({ error: "Build tidak ditemukan" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/builds — trigger build untuk aplikasi.
 * Command berasal dari Application config (trusted) — bukan input user.
 */
router.post("/", async (req, res) => {
    try {
        const { applicationId, environment, commit, branch } = req.body || {};
        if (!applicationId) return res.status(400).json({ error: "applicationId wajib diisi" });
        const env = environment || "development";

        const app = await Application.findById(applicationId);
        if (!app) return res.status(404).json({ error: "Aplikasi tidak ditemukan" });
        if (app.active === false) return res.status(400).json({ error: "Aplikasi tidak aktif" });

        // Validasi command dari config SEBELUM mengantri (fail-fast).
        const buildCmd = validateCommand(app.buildCommand || "npm run build");
        const testCmd = validateCommand(app.testCommand || "npm test");
        if (!buildCmd.ok || !testCmd.ok) {
            return res.status(400).json({
                error: `Konfigurasi command aplikasi tidak valid: ${[buildCmd.error, testCmd.error].filter(Boolean).join("; ")}`
            });
        }
        const cwd = path.resolve(process.env.DEPLOYMENT_WORKSPACE || "/srv");
        if (!validateCwd(cwd)) {
            return res.status(400).json({ error: "Workspace deployment tidak diizinkan" });
        }

        const build = await BuildRecord.create({
            applicationId,
            environment: env,
            commit: commit || "",
            branch: branch || app.branch || "main",
            status: "QUEUED",
            steps: [
                { name: "install", status: "PENDING" },
                { name: "test", status: "PENDING" },
                { name: "build", status: "PENDING" },
                { name: "package", status: "PENDING" }
            ],
            triggeredBy: req.user.name || req.user.username || "Super Admin"
        });

        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "build.trigger",
            targetType: "application",
            targetId: app.slug,
            targetName: app.name,
            metadata: { buildId: String(build._id), environment: env },
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        enqueue({
            id: `build-${build._id}`,
            type: "build",
            payload: { buildId: String(build._id), app: app.toObject(), environment: env }
        });

        res.status(201).json(build);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
