/**
 * Deployment API Routes — deployment lifecycle (SP-027 M5 §8-10, §19).
 *
 * Deployment: pilih Application + Environment + Release → queue worker →
 * deploy → verify → health-check (M4). SUCCESS hanya jika health check lolos.
 * Rollback = controlled operation (deploy ulang release sebelumnya), bukan
 * mekanisme palsu.
 *
 * Endpoint:
 *   GET  /api/deployments?applicationId=&environment=&status=  — history
 *   GET  /api/deployments/:id                                  — detail + logs
 *   POST /api/deployments                                      — trigger deploy
 *   POST /api/deployments/:id/rollback                         — rollback foundation
 *
 * @module console/server/routes/deployments
 */

import { Router } from "express";
import { DeploymentRecord } from "../models/DeploymentRecord.js";
import { DeploymentEnvironment } from "../models/DeploymentEnvironment.js";
import { Application } from "../models/Application.js";
import { ReleaseRecord } from "../models/ReleaseRecord.js";
import { security, audit } from "../security.js";
import { enqueue } from "../deployment/queue.js";

const router = Router();

router.use(security.authenticate, security.requireSuperAdmin);

/**
 * GET /api/deployments — deployment history (filter + pagination).
 */
router.get("/", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const query = {};
        if (req.query.applicationId) query.applicationId = req.query.applicationId;
        if (req.query.environment) query.environment = req.query.environment;
        if (req.query.status) query.status = req.query.status;

        const total = await DeploymentRecord.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await DeploymentRecord.find(query)
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
 * GET /api/deployments/:id — detail deployment + logs.
 */
router.get("/:id", async (req, res) => {
    try {
        const item = await DeploymentRecord.findById(req.params.id)
            .populate("applicationId", "slug name icon")
            .populate("releaseId", "version commit")
            .lean();
        if (!item) return res.status(404).json({ error: "Deployment tidak ditemukan" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/deployments — trigger deployment.
 * Super Admin memilih Application + Environment + Release — BUKAN shell command.
 */
router.post("/", async (req, res) => {
    try {
        const { applicationId, environment, releaseId } = req.body || {};
        if (!applicationId || !environment || !releaseId) {
            return res.status(400).json({ error: "applicationId, environment, dan releaseId wajib diisi" });
        }
        if (!["development", "staging", "production"].includes(environment)) {
            return res.status(400).json({ error: "environment tidak valid" });
        }

        const app = await Application.findById(applicationId);
        if (!app) return res.status(404).json({ error: "Aplikasi tidak ditemukan" });
        if (app.active === false) return res.status(400).json({ error: "Aplikasi tidak aktif" });

        const release = await ReleaseRecord.findOne({ _id: releaseId, applicationId });
        if (!release) return res.status(404).json({ error: "Release tidak ditemukan untuk aplikasi ini" });
        if (release.status === "rolled_back") {
            return res.status(400).json({ error: "Release ini sudah di-rollback dan tidak bisa di-deploy" });
        }

        const envDoc = await DeploymentEnvironment.findOne({ applicationId, name: environment });
        if (!envDoc) {
            return res.status(404).json({ error: `Environment \"${environment}\" belum dikonfigurasi untuk aplikasi ini` });
        }
        if (envDoc.status === "disabled") {
            return res.status(400).json({ error: `Environment \"${environment}\" dinonaktifkan` });
        }

        const deployment = await DeploymentRecord.create({
            applicationId,
            environment,
            version: release.version,
            commit: release.commit,
            releaseId: release._id,
            status: "QUEUED",
            steps: [
                { name: "deploy", status: "PENDING" },
                { name: "verify", status: "PENDING" },
                { name: "health-check", status: "PENDING" }
            ],
            triggeredBy: req.user.name || req.user.username || "Super Admin"
        });

        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "deployment.trigger",
            targetType: "application",
            targetId: app.slug,
            targetName: app.name,
            metadata: { deploymentId: String(deployment._id), environment, version: release.version },
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        enqueue({
            id: `deploy-${deployment._id}`,
            type: "deploy",
            payload: {
                deploymentId: String(deployment._id),
                app: app.toObject(),
                environment,
                release: release.toObject()
            }
        });

        res.status(201).json(deployment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/deployments/:id/rollback — controlled rollback.
 * Mengembalikan ke release SUCCESS terakhir sebelum deployment ini
 * (untuk environment yang sama), lalu menandai deployment ini ROLLED_BACK.
 */
router.post("/:id/rollback", async (req, res) => {
    try {
        const deployment = await DeploymentRecord.findById(req.params.id);
        if (!deployment) return res.status(404).json({ error: "Deployment tidak ditemukan" });
        if (deployment.status !== "SUCCESS") {
            return res.status(400).json({ error: "Hanya deployment SUCCESS yang bisa di-rollback" });
        }

        // Cari release terakhir yang berhasil di environment ini (sebelum deployment ini)
        const previous = await DeploymentRecord.findOne({
            applicationId: deployment.applicationId,
            environment: deployment.environment,
            status: "SUCCESS",
            createdAt: { $lt: deployment.createdAt }
        }).sort({ createdAt: -1 });

        if (!previous) {
            return res.status(409).json({ error: "Tidak ada deployment SUCCESS sebelumnya untuk di-rollback" });
        }

        // Guard: deployment lama tanpa releaseId (legacy/manual) — jangan query
        // release sembarang (findOne({ _id: undefined }) = findOne({}) ).
        if (!previous.releaseId) {
            return res.status(409).json({ error: "Deployment sebelumnya tidak memiliki release (tidak bisa di-rollback otomatis)" });
        }

        const release = await ReleaseRecord.findOne({ _id: previous.releaseId });
        if (!release) {
            return res.status(409).json({ error: "Release sebelumnya tidak ditemukan" });
        }

        // Tandai deployment ini ROLLED_BACK
        deployment.status = "ROLLED_BACK";
        await deployment.save();

        // Buat deployment rollback baru (deploy ulang release sebelumnya)
        const rollback = await DeploymentRecord.create({
            applicationId: deployment.applicationId,
            environment: deployment.environment,
            version: release.version,
            commit: release.commit,
            releaseId: release._id,
            status: "QUEUED",
            steps: [
                { name: "deploy", status: "PENDING" },
                { name: "verify", status: "PENDING" },
                { name: "health-check", status: "PENDING" }
            ],
            triggeredBy: req.user.name || req.user.username || "Super Admin",
            rollbackOf: deployment._id
        });

        const app = await Application.findById(deployment.applicationId);
        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "deployment.rollback",
            targetType: "application",
            targetId: app?.slug || "",
            targetName: app?.name || "",
            metadata: {
                deploymentId: String(deployment._id),
                rollbackDeploymentId: String(rollback._id),
                environment: deployment.environment,
                fromVersion: deployment.version,
                toVersion: release.version
            },
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        enqueue({
            id: `deploy-${rollback._id}`,
            type: "deploy",
            payload: {
                deploymentId: String(rollback._id),
                app: app ? app.toObject() : {},
                environment: deployment.environment,
                release: release.toObject()
            }
        });

        res.status(201).json({ rolledBack: deployment, rollbackDeployment: rollback });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
