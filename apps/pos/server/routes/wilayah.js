/**
 * Wilayah Route — Serve wilayah.json for hierarchical region selection.
 *
 * GET /api/wilayah — Returns full wilayah data
 * GET /api/wilayah/provinces — Returns only provinces (code → name)
 *
 * @module server/routes/wilayah
 */

import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// Resolve path to shared/data/wilayah.json (from server root → ../../shared/data/wilayah.json)
const wilayahPath = path.resolve(__dirname, "../../../../shared/data/wilayah.json");

let wilayahCache = null;

function loadWilayah() {
    if (wilayahCache) return wilayahCache;
    try {
        if (fs.existsSync(wilayahPath)) {
            const raw = fs.readFileSync(wilayahPath, "utf-8");
            wilayahCache = JSON.parse(raw);
            return wilayahCache;
        }
    } catch (err) {
        console.error("[Wilayah] Failed to load:", err.message);
    }
    return null;
}

// GET /api/wilayah — Full data
router.get("/", (req, res) => {
    const data = loadWilayah();
    if (!data) {
        return res.status(500).json({ error: "Wilayah data tidak tersedia" });
    }
    res.json({ data });
});

// GET /api/wilayah/provinces — List of provinces { code, name }
router.get("/provinces", (req, res) => {
    const data = loadWilayah();
    if (!data) {
        return res.status(500).json({ error: "Wilayah data tidak tersedia" });
    }
    const provinces = Object.entries(data).map(([code, prov]) => ({
        code,
        name: prov.nama
    }));
    res.json({ data: provinces });
});

// GET /api/wilayah/:provCode/regencies — List regencies for a province
router.get("/:provCode/regencies", (req, res) => {
    const data = loadWilayah();
    if (!data) return res.status(500).json({ error: "Wilayah data tidak tersedia" });

    const prov = data[req.params.provCode];
    if (!prov) return res.status(404).json({ error: "Provinsi tidak ditemukan" });

    const regencies = Object.entries(prov.kabupaten || {}).map(([code, kab]) => ({
        code,
        name: kab.nama
    }));
    res.json({ data: regencies });
});

// GET /api/wilayah/:provCode/:kabCode/districts — List districts for a regency
router.get("/:provCode/:kabCode/districts", (req, res) => {
    const data = loadWilayah();
    if (!data) return res.status(500).json({ error: "Wilayah data tidak tersedia" });

    const prov = data[req.params.provCode];
    if (!prov) return res.status(404).json({ error: "Provinsi tidak ditemukan" });

    const kab = prov.kabupaten?.[req.params.kabCode];
    if (!kab) return res.status(404).json({ error: "Kabupaten tidak ditemukan" });

    const districts = Object.entries(kab.kecamatan || {}).map(([code, kec]) => ({
        code,
        name: kec.nama
    }));
    res.json({ data: districts });
});

// GET /api/wilayah/:provCode/:kabCode/:kecCode/villages — List villages for a district
router.get("/:provCode/:kabCode/:kecCode/villages", (req, res) => {
    const data = loadWilayah();
    if (!data) return res.status(500).json({ error: "Wilayah data tidak tersedia" });

    const prov = data[req.params.provCode];
    if (!prov) return res.status(404).json({ error: "Provinsi tidak ditemukan" });

    const kab = prov.kabupaten?.[req.params.kabCode];
    if (!kab) return res.status(404).json({ error: "Kabupaten tidak ditemukan" });

    const kec = kab.kecamatan?.[req.params.kecCode];
    if (!kec) return res.status(404).json({ error: "Kecamatan tidak ditemukan" });

    const villages = Object.entries(kec.desa || {}).map(([code, desa]) => ({
        code,
        name: desa.nama
    }));
    res.json({ data: villages });
});

// Clear cache (if needed)
router.post("/refresh", (req, res) => {
    wilayahCache = null;
    res.json({ success: true });
});

export default router;
