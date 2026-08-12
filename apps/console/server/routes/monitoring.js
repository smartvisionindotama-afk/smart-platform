/**
 * Monitoring API Routes — SMART Platform Monitoring Center (SP-027 M4).
 *
 * Seluruh endpoint WAJIB access token superadmin (Security M3):
 *   - authenticate()        → 401 tanpa token valid
 *   - requireSuperAdmin()   → 403 untuk non-superadmin
 * Tidak ada monitoring endpoint publik.
 *
 * Endpoint:
 *   GET /api/monitoring/overview        — ringkasan platform lengkap
 *   GET /api/monitoring/applications    — health aplikasi
 *   GET /api/monitoring/services        — health service (console/inventory/mongodb)
 *   GET /api/monitoring/infrastructure  — CPU/RAM/Disk/Load/Uptime
 *   GET /api/monitoring/database        — health MongoDB
 *   GET /api/monitoring/processes       — status proses (PM2)
 *   GET /api/monitoring/history         — event monitoring terbaru (retensi)
 *   GET /api/monitoring/health          — health check contract (reusable)
 *
 * @module console/server/routes/monitoring
 */

import { Router } from "express";
import { runFullCheck, platformHealth } from "../monitoring/service.js";
import { listRecentHistory } from "../monitoring/history.js";
import { security } from "../security.js";

const router = Router();

/** Proteksi: hanya Super Admin platform. */
router.use(security.authenticate, security.requireSuperAdmin);

/**
 * GET /api/monitoring/health
 * Health check contract platform (SP-027 M4 §5) — reusable oleh app lain.
 */
router.get("/health", async (req, res) => {
    try {
        const contract = await platformHealth();
        res.json(contract);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/monitoring/overview
 * Ringkasan lengkap untuk dashboard Monitoring Center.
 */
router.get("/overview", async (req, res) => {
    try {
        const data = await runFullCheck();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/monitoring/applications
 * Health seluruh aplikasi terdaftar (registry, extensible).
 */
router.get("/applications", async (req, res) => {
    try {
        const data = await runFullCheck();
        res.json({ timestamp: data.timestamp, status: data.summary, applications: data.applications });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/monitoring/services
 * Health service: console-api, inventory-api, mongodb.
 */
router.get("/services", async (req, res) => {
    try {
        const data = await runFullCheck();
        res.json({ timestamp: data.timestamp, status: data.status, services: data.services });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/monitoring/infrastructure
 * CPU / memory / disk / load average / uptime.
 */
router.get("/infrastructure", async (req, res) => {
    try {
        const data = await runFullCheck();
        res.json({ timestamp: data.timestamp, status: data.infrastructure.status, infrastructure: data.infrastructure });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/monitoring/database
 * Health MongoDB (ping ringan — tidak ada query berat).
 */
router.get("/database", async (req, res) => {
    try {
        const data = await runFullCheck();
        res.json({ timestamp: data.timestamp, status: data.database.status, database: data.database });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/monitoring/processes
 * Status proses via PM2 (kondisi aktual server — bukan asumsi).
 */
router.get("/processes", async (req, res) => {
    try {
        const data = await runFullCheck();
        res.json({ timestamp: data.timestamp, status: data.processes.status, processes: data.processes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/monitoring/history?limit=50
 * Event monitoring terbaru (retensi TTL).
 */
router.get("/history", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50;
        const history = await listRecentHistory({ limit });
        res.json({ timestamp: Date.now(), count: history.length, events: history });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
