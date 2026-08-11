/**
 * Barang Gudang Routes — Stock per Warehouse.
 *
 * GET    /       — List stock (filter by company, barang, gudang)
 * POST   /init   — Initialize/fix stock for existing barang
 *
 * @module server/routes/barang-gudang
 */

import { Router } from "express";
import { BarangGudang } from "../models/BarangGudang.js";
import { Barang } from "../models/Barang.js";
import { Warehouse } from "../models/Warehouse.js";

const router = Router();

/**
 * GET / — List stock per gudang.
 * Query params: page, limit, kodeBarang, kodeGudang
 */
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const companyCode = req.headers["x-company-code"];
        const kodeBarang = req.query.kodeBarang;
        const kodeGudang = req.query.kodeGudang;

        let query = {};
        if (companyCode) query.companyCode = companyCode;
        if (kodeBarang) query.kodeBarang = kodeBarang;
        if (kodeGudang) query.kodeGudang = kodeGudang;

        const total = await BarangGudang.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await BarangGudang.find(query)
            .sort({ kodeBarang: 1, kodeGudang: 1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /init — Initialize stock per gudang from existing Barang data.
 * For each barang, creates a barang_gudang record if not exists.
 * Safe to run multiple times (idempotent).
 */
router.post("/init", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });

        const barangs = await Barang.find({ companyCode });
        const warehouses = await Warehouse.find({ companyCode });
        let created = 0;
        let skipped = 0;

        for (const b of barangs) {
            // Tentukan gudang: dari field gudang barang, atau warehouse pertama
            let kodeGudang = b.gudang || (warehouses.length > 0 ? warehouses[0].kode : "");
            if (!kodeGudang) continue;

            const existing = await BarangGudang.findOne({
                companyCode, kodeBarang: b.kode, kodeGudang
            });

            if (!existing) {
                await BarangGudang.create({
                    companyCode,
                    kodeBarang: b.kode,
                    kodeGudang,
                    stok: b.stok || 0
                });
                created++;
            } else {
                skipped++;
            }
        }

        res.json({ success: true, created, skipped, totalBarang: barangs.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
