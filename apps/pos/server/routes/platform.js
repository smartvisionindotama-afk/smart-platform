/**
 * Platform Settings Routes.
 *
 * Menyimpan logo platform di server sehingga bisa diakses
 * dari seluruh subdomain (inv.e-profit.id, master.e-profit.id, dll).
 *
 * Logo disimpan sebagai file JSON di disk (data URL base64).
 * Tidak perlu MongoDB model — cukup file-based storage.
 */

import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const LOGO_FILE = path.join(DATA_DIR, "platform-logo.json");

const router = Router();

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * GET /api/platform/logo
 * Return the stored platform logo (data URL or null).
 */
router.get("/logo", (req, res) => {
    try {
        if (!fs.existsSync(LOGO_FILE)) {
            return res.json({ logo: null });
        }
        const raw = fs.readFileSync(LOGO_FILE, "utf-8");
        const data = JSON.parse(raw);
        res.json({ logo: data.logo || null });
    } catch (err) {
        console.warn("[Platform Logo] Failed to read:", err.message);
        res.json({ logo: null });
    }
});

/**
 * POST /api/platform/logo
 * Save/update the platform logo (expects { logo: "data:image/..." }).
 * Max 5MB to match localStorage constraint.
 */
router.post("/logo", (req, res) => {
    try {
        const { logo } = req.body;
        if (!logo) {
            return res.status(400).json({ error: "Logo data wajib diisi" });
        }

        // Validate data URL format
        if (!logo.startsWith("data:")) {
            return res.status(400).json({ error: "Format logo tidak valid" });
        }

        // Check size (data URL: approximate base64 size)
        const sizeBytes = Buffer.byteLength(logo, "utf-8");
        if (sizeBytes > 5 * 1024 * 1024) {
            return res.status(400).json({ error: "Ukuran logo maksimal 5MB" });
        }

        fs.writeFileSync(LOGO_FILE, JSON.stringify({ logo, updatedAt: Date.now() }));
        console.log(`[Platform Logo] Saved (${(sizeBytes / 1024).toFixed(1)}KB)`);
        res.json({ success: true });
    } catch (err) {
        console.error("[Platform Logo] Failed to save:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/platform/logo
 * Remove the stored platform logo.
 */
router.delete("/logo", (req, res) => {
    try {
        if (fs.existsSync(LOGO_FILE)) {
            fs.unlinkSync(LOGO_FILE);
            console.log("[Platform Logo] Deleted");
        }
        res.json({ success: true });
    } catch (err) {
        console.error("[Platform Logo] Failed to delete:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * ── App Logo Routes ──
 * Per-application logo storage.
 * Each app has its own logo file: platform-app-logo-{slug}.json
 */

function getAppLogoFile(slug) {
    const safeSlug = slug.replace(/[^a-z0-9\-]/g, "_");
    return path.join(DATA_DIR, `platform-app-logo-${safeSlug}.json`);
}

/**
 * GET /api/platform/app-logo/:slug
 * Return the stored logo for a specific app.
 */
router.get("/app-logo/:slug", (req, res) => {
    try {
        const filePath = getAppLogoFile(req.params.slug);
        if (!fs.existsSync(filePath)) {
            return res.json({ logo: null });
        }
        const raw = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(raw);
        res.json({ logo: data.logo || null });
    } catch (err) {
        console.warn(`[App Logo] Failed to read for ${req.params.slug}:`, err.message);
        res.json({ logo: null });
    }
});

/**
 * POST /api/platform/app-logo/:slug
 * Save/update logo for a specific app.
 */
router.post("/app-logo/:slug", (req, res) => {
    try {
        const { logo } = req.body;
        if (!logo) {
            return res.status(400).json({ error: "Logo data wajib diisi" });
        }
        if (!logo.startsWith("data:")) {
            return res.status(400).json({ error: "Format logo tidak valid" });
        }

        const sizeBytes = Buffer.byteLength(logo, "utf-8");
        if (sizeBytes > 5 * 1024 * 1024) {
            return res.status(400).json({ error: "Ukuran logo maksimal 5MB" });
        }

        const filePath = getAppLogoFile(req.params.slug);
        fs.writeFileSync(filePath, JSON.stringify({ logo, appSlug: req.params.slug, updatedAt: Date.now() }));
        console.log(`[App Logo] Saved for ${req.params.slug} (${(sizeBytes / 1024).toFixed(1)}KB)`);
        res.json({ success: true });
    } catch (err) {
        console.error(`[App Logo] Failed to save for ${req.params.slug}:`, err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/platform/app-logo/:slug
 * Remove the stored logo for a specific app.
 */
router.delete("/app-logo/:slug", (req, res) => {
    try {
        const filePath = getAppLogoFile(req.params.slug);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[App Logo] Deleted for ${req.params.slug}`);
        }
        res.json({ success: true });
    } catch (err) {
        console.error(`[App Logo] Failed to delete for ${req.params.slug}:`, err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
