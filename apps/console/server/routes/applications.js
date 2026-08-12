/**
 * Application API Routes — daftar aplikasi platform (CRUD).
 *
 * SP-027 PRE-M5 round 5: aplikasi platform sebelumnya registry STATIS
 * (mock in-memory client) — kini disimpan di MongoDB (model Application)
 * dan dikelola via API. Halaman Applications memakai route ini sebagai
 * sumber kebenaran; aplikasi baru bisa dihubungkan ke perusahaan
 * (Company.apps) dan diverifikasi pada impersonation.
 *
 * Proteksi: authenticate + requireSuperAdmin (Security M3) — tidak ada
 * endpoint publik. Setiap mutasi dicatat ke audit log.
 *
 * Endpoint:
 *   GET    /api/applications?page=&limit=&search=&status=  — list
 *   GET    /api/applications/:slug                         — detail
 *   POST   /api/applications                               — create
 *   PUT    /api/applications/:slug                         — update
 *   DELETE /api/applications/:slug                         — delete
 *
 * @module console/server/routes/applications
 */

import { Router } from "express";
import { Application } from "../models/Application.js";
import { security, audit } from "../security.js";

const router = Router();

/** Proteksi: hanya Super Admin platform. */
router.use(security.authenticate, security.requireSuperAdmin);

/**
 * Normalisasi slug: huruf kecil, hanya a-z0-9 dan tanda hubung.
 * @param {string} slug
 * @returns {string}
 */
export function normalizeSlug(slug) {
    return String(slug || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * Validasi payload aplikasi — kembalikan daftar error (fungsi murni).
 * @param {object} data
 * @returns {string[]} Daftar error (kosong = valid)
 */
export function validateApplicationPayload(data = {}) {
    const errors = [];
    if (!data.name || !String(data.name).trim()) {
        errors.push("Nama aplikasi wajib diisi");
    }
    if (!data.slug) {
        errors.push("Slug aplikasi wajib diisi");
    } else if (!/^[a-z0-9][a-z0-9-]*$/.test(String(data.slug).trim())) {
        errors.push("Slug hanya boleh huruf kecil, angka, dan tanda hubung (contoh: my-app)");
    }
    return errors;
}

/**
 * GET /api/applications — list dengan search, filter status, pagination.
 */
router.get("/", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const search = String(req.query.search || "").trim();
        const status = req.query.status || "all";

        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { slug: { $regex: search, $options: "i" } },
                { code: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            ];
        }
        if (status === "active") query.active = true;
        if (status === "inactive") query.active = false;

        const total = await Application.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await Application.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        res.json({
            data,
            pagination: { page: Math.min(page, totalPages), limit, total, totalPages }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/applications/:slug — detail satu aplikasi.
 */
router.get("/:slug", async (req, res) => {
    try {
        // Normalisasi slug agar lookup konsisten (case-insensitive di praktik:
        // slug selalu lowercase karena normalizeSlug saat create).
        const item = await Application.findOne({ slug: normalizeSlug(req.params.slug) }).lean();
        if (!item) return res.status(404).json({ error: "Aplikasi tidak ditemukan" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/applications — buat aplikasi baru.
 */
router.post("/", async (req, res) => {
    try {
        const data = req.body || {};
        const errors = validateApplicationPayload(data);
        if (errors.length) {
            return res.status(400).json({ error: errors.join("; ") });
        }

        const slug = normalizeSlug(data.slug);
        const existing = await Application.findOne({ slug });
        if (existing) {
            return res.status(409).json({ error: `Slug \"${slug}\" sudah digunakan` });
        }

        const item = await Application.create({
            slug,
            name: String(data.name).trim(),
            code: String(data.code || "").trim(),
            icon: String(data.icon || "📦"),
            description: String(data.description || "").trim(),
            domain: String(data.domain || "").trim(),
            environment: data.environment || "staging",
            workspace: data.workspace || "default",
            version: String(data.version || "0.1.0").trim(),
            active: data.active !== false,
            // SP-027 M5 — deployment config (trusted, divalidasi saat deploy)
            repository: String(data.repository || "").trim(),
            branch: String(data.branch || "main").trim(),
            buildCommand: String(data.buildCommand || "npm run build").trim(),
            testCommand: String(data.testCommand || "npm test").trim(),
            startCommand: String(data.startCommand || "pm2 start").trim(),
            deploymentTarget: String(data.deploymentTarget || "").trim(),
            healthEndpoint: String(data.healthEndpoint || "").trim(),
            createdBy: req.user.id || null
        });

        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "app.create",
            targetType: "application",
            targetId: item.slug,
            targetName: item.name,
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.status(201).json(item);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: "Slug aplikasi sudah digunakan" });
        }
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/applications/:slug — update aplikasi.
 */
router.put("/:slug", async (req, res) => {
    try {
        const item = await Application.findOne({ slug: req.params.slug });
        if (!item) return res.status(404).json({ error: "Aplikasi tidak ditemukan" });

        const data = req.body || {};
        // Nama wajib saat update (jika dikirim); slug tidak bisa diubah via PUT
        // (identitas) — gunakan DELETE + CREATE bila perlu rename.
        if (data.name !== undefined && !String(data.name).trim()) {
            return res.status(400).json({ error: "Nama aplikasi wajib diisi" });
        }

        const fields = [
            "name", "code", "icon", "description", "domain", "environment", "workspace", "version", "active",
            // SP-027 M5 — deployment config
            "repository", "branch", "buildCommand", "testCommand", "startCommand", "deploymentTarget", "healthEndpoint"
        ];
        for (const f of fields) {
            if (data[f] !== undefined) item[f] = data[f];
        }
        item.updatedBy = req.user.id || null;
        const saved = await item.save();

        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "app.update",
            targetType: "application",
            targetId: saved.slug,
            targetName: saved.name,
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/applications/:slug — hapus aplikasi.
 * Jika masih dipakai oleh ≥1 perusahaan, tolak (proteksi integritas).
 */
router.delete("/:slug", async (req, res) => {
    try {
        const item = await Application.findOne({ slug: req.params.slug });
        if (!item) return res.status(404).json({ error: "Aplikasi tidak ditemukan" });

        // Proteksi: aplikasi yang masih terhubung ke perusahaan tidak bisa
        // dihapus — cegah company.apps menunjuk aplikasi yang tidak ada.
        const { Company } = await import("../models/Company.js");
        const usedBy = await Company.countDocuments({ apps: req.params.slug });
        if (usedBy > 0) {
            return res.status(409).json({
                error: `Aplikasi \"${item.name}\" masih terhubung ke ${usedBy} perusahaan. Lepaskan akses aplikasi di perusahaan tersebut terlebih dahulu.`
            });
        }

        await Application.deleteOne({ _id: item._id });

        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "app.delete",
            targetType: "application",
            targetId: item.slug,
            targetName: item.name,
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
