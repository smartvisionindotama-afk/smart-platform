/**
 * Environment API Routes — abstraction environment per aplikasi (SP-027 M5 §5).
 *
 * development / staging / production. Jika infrastructure hanya punya
 * production, environment lain tetap ada sebagai abstraction.
 *
 * Endpoint:
 *   GET  /api/environments?applicationId=      — list (filter per aplikasi)
 *   POST /api/environments                     — create (applicationId + name)
 *   PUT  /api/environments/:id                 — update target/branch/status
 *   GET  /api/environments/:id                 — detail
 *
 * @module console/server/routes/environments
 */

import { Router } from "express";
import { DeploymentEnvironment } from "../models/DeploymentEnvironment.js";
import { Application } from "../models/Application.js";
import { security, audit } from "../security.js";

const router = Router();

router.use(security.authenticate, security.requireSuperAdmin);

/** Nama environment yang dikenal. */
export const ENV_NAMES = ["development", "staging", "production"];

/**
 * GET /api/environments — list environment, filter optional applicationId.
 */
router.get("/", async (req, res) => {
    try {
        const query = {};
        if (req.query.applicationId) query.applicationId = req.query.applicationId;
        const data = await DeploymentEnvironment.find(query)
            .populate("applicationId", "slug name icon active")
            .sort({ applicationId: 1, name: 1 })
            .lean();
        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/environments/:id — detail environment.
 */
router.get("/:id", async (req, res) => {
    try {
        const item = await DeploymentEnvironment.findById(req.params.id)
            .populate("applicationId", "slug name icon active")
            .lean();
        if (!item) return res.status(404).json({ error: "Environment tidak ditemukan" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/environments — create environment untuk aplikasi.
 */
router.post("/", async (req, res) => {
    try {
        const { applicationId, name, target, branch, status, monitoringEnabled } = req.body || {};
        if (!applicationId) return res.status(400).json({ error: "applicationId wajib diisi" });
        if (!ENV_NAMES.includes(name)) {
            return res.status(400).json({ error: `name harus salah satu dari: ${ENV_NAMES.join(", ")}` });
        }
        const app = await Application.findById(applicationId);
        if (!app) return res.status(404).json({ error: "Aplikasi tidak ditemukan" });

        const existing = await DeploymentEnvironment.findOne({ applicationId, name });
        if (existing) return res.status(409).json({ error: `Environment \"${name}\" sudah ada untuk aplikasi ini` });

        const item = await DeploymentEnvironment.create({
            applicationId,
            name,
            target: target || "",
            branch: branch || "main",
            status: status === "disabled" ? "disabled" : "configured",
            monitoringEnabled: monitoringEnabled !== false,
            createdBy: req.user.id || null
        });

        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "env.create",
            targetType: "application",
            targetId: app.slug,
            targetName: app.name,
            metadata: { environment: name },
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.status(201).json(item);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: "Environment sudah ada" });
        }
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/environments/:id — update konfigurasi environment.
 */
router.put("/:id", async (req, res) => {
    try {
        const item = await DeploymentEnvironment.findById(req.params.id);
        if (!item) return res.status(404).json({ error: "Environment tidak ditemukan" });

        const { target, branch, status, monitoringEnabled } = req.body || {};
        if (target !== undefined) item.target = String(target);
        if (branch !== undefined) item.branch = String(branch);
        if (status !== undefined && ["configured", "disabled"].includes(status)) item.status = status;
        if (monitoringEnabled !== undefined) item.monitoringEnabled = monitoringEnabled;
        item.updatedBy = req.user.id || null;

        const saved = await item.save();

        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "env.update",
            targetType: "application",
            targetId: item.applicationId?.toString() || "",
            targetName: item.name,
            metadata: { target, branch, status },
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
